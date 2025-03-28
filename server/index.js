// look into using https://www.npmjs.com/package/aws-lambda-router

const fs = require('fs');
const fsPromises = require('fs/promises');
const geolib = require('geolib');
const jwt = require('jsonwebtoken');

const { CloudFrontClient, CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');

const fetch = require('node-fetch');

const authUrl = process.env.AUTH_URL;
const privacyZones = JSON.parse(process.env.PRIVACY_ZONES ?? '[]');

const minuteInSeconds = 60;
const hourInSeconds = minuteInSeconds * 60;
const dayInSeconds = hourInSeconds * 24;
const yearInSeconds = dayInSeconds * 365;

const routeCacheValues = {
	'/api/yt-thumbnail': yearInSeconds,
};

async function authenticate(event) {
  let token;
	try {
		const publicKey = Buffer.from(process.env.AUTH_PUBLIC_KEY, 'base64').toString();
		const [, token] = event.headers.authorization.split('Bearer ');

		const verified = jwt.verify(token, publicKey, { algorithm: 'RS256' });

		if (verified) {
			event.isAuthed = true;
			
			const [, content] = token.split('.').slice(0, 2).map(e => JSON.parse(Buffer.from(e, 'base64').toString()));
			event.authExpires = new Date(content.exp * 1000).toUTCString();
		} else {
      console.log('Authentication failed', authUrl, event.headers.authorization);
    }
	} catch (e) {
    console.error('Something went wrong during authentication', e, token);
  }
	console.log({ isAuthed: event.isAuthed });
}

function verifyBodyIsString(result) {
	if (result.body && typeof result.body !== 'string') {
		result.body = JSON.stringify(result.body);
	}
}

function verifyCacheValue(event, result, rawPath) {
  if (!result.headers) result.headers = {};
  const { headers } = result;
	if (event.authExpires) {
		const nowInSeconds = Math.floor(new Date().getTime() / 1000);
		const maxAge = Math.max(0, event.authExpires - nowInSeconds);
		console.log(JSON.stringify({ authExpires: event.authExpires, nowInSeconds, maxAge }));
		headers['expires'] = event.authExpires;
	}	else if (!headers['cache-control'] && !headers['expires']) {
		if (routeCacheValues[rawPath]) {
			const cacheValue = routeCacheValues[rawPath];
			headers['cache-control'] = `max-age=${cacheValue}`;
		} else {
			headers['cache-control'] = `max-age=${yearInSeconds}`;
		}
	}
	console.log(`Set cache-control header to [${headers['cache-control']}], expires to [${headers.expires}]`);
}

function logResult(result) {
	if (Boolean(process.env['LOG_RESULT'])) {
		console.log('Returning result', JSON.stringify(result, null, '  '));
	}
}

function makeFeatureSafeForUnauthed(feature) {
	if (feature.properties.isPrivate) {
		const midpoint = feature.geometry.coordinates[Math.floor(feature.geometry.coordinates.length / 2)];

		feature.geometry = {
			type: "LineString",
			coordinates: [
				midpoint,
				midpoint
			]
		};
	}

	delete feature.properties.isPrivate;
	delete feature.properties.name;
	delete feature.properties.path;
}

function getGeoJsonFromCoords(coords, isAuthed) {
	let coordinates = coords.map(({ lat, lon }) => [lon, lat]);

	if (!isAuthed) {
		coordinates = coordinates.filter(([longitude, latitude]) => {
			return !privacyZones.some((zone) => {
				return geolib.isPointWithinRadius({ latitude, longitude }, zone.coords, zone.radius);
			});
		});
	}

	return {
		type: "Feature",
		properties: {},
		geometry: {
			type: "LineString",
			coordinates,
		}
	};
}

function getBenchmarkedFunction(func) {
	return function(...args) {
		const s = new Date().getTime();
		func(...args);
		console.log(`${func.name} completed in ${new Date().getTime() - s}ms`);
	};
}

function getBenchmarkedFunctionAsync(func) {
	return async function(...args) {
		const s = new Date().getTime();
		const result = await func(...args);
		console.log(`${func.name} completed in ${new Date().getTime() - s}ms`);
		return result;
	};
}

async function getEventsByMonth(event) {
	const { headers: { accept }, queryStringParameters: { q: month } = {} } = event;
	const ext = accept.toLowerCase() === 'text/csv' ? '.csv' : '.json';
	const content = await fsPromises.readFile(`./walks/${month}${ext}`);
	return accept.toLowerCase() === 'text/csv' ? content.toString() : JSON.parse(content);
}
const getEventsByMonthBenched = getBenchmarkedFunctionAsync(getEventsByMonth);

async function getCoordsByMonth(month) {
	return JSON.parse(await fsPromises.readFile(`./coords/${month}.json`));
}
const getCoordsByMonthBenched = getBenchmarkedFunctionAsync(getCoordsByMonth);

async function getAllEventsByPlate(event) {
	let {
		queryStringParameters: {
			filterByCount = false,
			filterByName = false,
			sortByCount = false,
			nameContains = false,
		} = {},
		headers: { accept },
	} = event;

	if (nameContains !== false) {
		filterByName = true;
	}

	if (filterByCount !== false) {
		filterByCount = parseInt(filterByCount, 10);
		if (isNaN(filterByCount) || filterByCount <= 0) {
			throw new Error('filterByCount must be a number greater than 0');
		}
	}

	let result = JSON.parse(await fsPromises.readFile(`./plates/plates.json`));

	if (filterByName !== false) {
		console.log(`Applying filterByName [${filterByName}]`);
		result = Object.keys(result)
			.filter(key => result[key].some(event => event.name))
			.reduce((acc, key) => {
				acc[key] = result[key];
				return acc;
			}, {});
	}
	if (nameContains !== false) {
		console.log(`Applying nameContains [${nameContains}]`);
		result = Object.keys(result)
			.reduce((acc, key) => {
				acc[key] = result[key].filter(e => e.name?.toUpperCase().includes(nameContains.toUpperCase()));
				return acc;
			}, {});
	}
	if (filterByCount !== false) {
		console.log(`Applying filterByCount [${filterByCount}]`);
		result = Object.keys(result)
			.filter(key => result[key].length >= filterByCount)
			.reduce((acc, key) => {
				acc[key] = result[key];
				return acc;
			}, {});
	}
	if (sortByCount !== false) {
		console.log(`Applying sortByCount [${sortByCount}]`);
		result = Object.keys(result)
			.toSorted((a, b) => result[a].length > result[b].length ? -1 : result[a].length < result[b].length ? 1 : 0)
			.reduce((acc, key) => {
				acc[key] = result[key];
				return acc;
			}, {});
	}

	const keys = Object.keys(result);
	for (let key of keys) {
		if (!result[key].length) {
			delete result[key];
		}
	}

	if (accept === 'text/csv') {
		const header = `"plate","date","name","link","resi"\n`;
		result = header + Object.keys(result).reduce((acc, plate) => {
			const plateEvents = result[plate];
			plateEvents.forEach(({ date, name, link, resi }) => {
				const line = `"${plate}","${date}","${name || ''}","${link || ''}","${resi || ''}"`;
				acc.push(line);
			});
			return acc;
		}, []).join('\n');
	}

	return result;
}
const getAllEventsByPlateBenched = getBenchmarkedFunctionAsync(getAllEventsByPlate);

async function getAllYoutubeIds() {
	return JSON.parse(await fsPromises.readFile(`./youtubeIds/youtubeIds.json`));
}
const getAllYoutubeIdsBenched = getBenchmarkedFunctionAsync(getAllYoutubeIds);

async function getGlobalStats() {
	return JSON.parse(await fsPromises.readFile(`./globalStats/globalStats.json`));
}
const getGlobalStatsBenched = getBenchmarkedFunctionAsync(getGlobalStats);

exports.handler = async (event) => {
	try {
		const { rawPath } = event;
		if (Boolean(process.env['LOG_RAW_PATH'])) {
			console.log(rawPath);
		}

		try {
			if (event.body) {
				event.body = JSON.parse(atob(event.body));
			}
		} catch (e) {
			console.warn('Body seems to exist but it failed to parse', e);
		}

		if (event?.headers?.authorization) {
			await authenticate(event);
		}

		const isApiRequest = rawPath.startsWith('/api');
		const handlerFunction = isApiRequest ? handleApiRequest : handleContentRequest;

		let result = await handlerFunction(event);
		if (!result.statusCode) {
			throw new Error(`The result returned has an incorrect format: ${JSON.stringify(result)}`);
		}

		verifyBodyIsString(result);
		verifyCacheValue(event, result, rawPath);
		logResult(result);

		return result;
	} catch (e) {
		console.error('Unhandled exception:', e);

		return setJsonContentType({
			statusCode: 500,
		});
	}
};

async function handleApiRequest(event) {
	const { queryStringParameters = null, rawPath } = event;

	console.log(`handle api request for ${rawPath}${queryStringParameters ? ' ' + JSON.stringify(queryStringParameters) : ''}`);

	const routeMap = {
		'/api/sunx': handleSunxDataRequest,
		'/api/yt-thumbnail': handleYouTubeThumbnailRequest,
		'/api/routes': handleWalkRouteRequest,
		'/api/events': handleEventsRequest,
		'/api/plates': handlePlatesRequest,
		'/api/youtubeIds': handleYoutubeIdsRequest,
		'/api/globalStats': handleGlobalStatsRequest,
		'/api/invalidateCache': handleCacheInvalidate,
		'/api/git': handleGitRequest,
    '/api/authtest': async (event) => {
      return {
        statusCode: 200,
        body: JSON.stringify(event),
        headers: { 'content-type': 'application/json' },
      };
    },
	};

	const func = routeMap[rawPath] ?? async function() { return { statusCode: 404 }; };

	return await func(event);
}

async function handleGitRequest() {
	const content = await fsPromises.readFile('./git.json', 'utf8');
	return {
		statusCode: 200,
		body: content,
		headers: {
			'content-type': 'application/json'
		}
	};
}

async function handleCacheInvalidate(event) {
	const { body: { paths = null } = {}, isAuthed } = event;

	if (!isAuthed) {
		return {
			statusCode: 401,
		}
	}

	if (!paths) {
		return {
			statusCode: 400,
			body: JSON.stringify({ error: 'paths is missing from the request body' }),
			'content-type': 'application/json',
		};
	}

	const cfInput = {
		DistributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
		InvalidationBatch: {
			CallerReference: new Date().getTime().toString(),
			Paths: {
				Items: paths,
				Quantity: paths.length,
			}
		}
	};

	const cfClient = new CloudFrontClient({ region: process.env.AWS_REGION });
	const cfCommand = new CreateInvalidationCommand(cfInput);

	console.log(`Invalidating CloudFront cache using command:\n${JSON.stringify(cfCommand)}`);
	const result = JSON.stringify(await cfClient.send(cfCommand));
	console.log('Invalidation result', result);

	return {
		statusCode: 200,
		body: result,
		'content-type': 'application/json',
	};
}

async function handleWalkRouteRequest(event) {
	const { isAuthed, queryStringParameters: { date } } = event;

	if (!date?.match(/\d{4}-\d{2}-\d{2}/)) {
		return {
			statusCode: 400,
			body: JSON.stringify({ error: "date must be provided and in yyyy-MM-dd format" }),
			headers: { 'content-type': 'application/json' },
		};
	}

	const [month] = date.match(/\d{4}-\d{2}/);

	const parsed = await getCoordsByMonthBenched(month);
	const target = parsed.filter(e => e.date === date);

	let geojson = target.reduce((acc, walk) => {
		const newEntry = getGeoJsonFromCoords(walk.coords, isAuthed);

		newEntry.properties.date = walk.date;
		if (walk.route) {
			newEntry.properties.route = walk.route;
		}

		acc.push(newEntry);
		return acc;
	}, []);

	geojson = {
		type: "FeatureCollection",
		features: geojson,
	};

	const encodedRouteData = encodeURIComponent(JSON.stringify(geojson));

	const body = `
	<html>
		<body>
			<script>
				window.location = 'https://geojson.io/#data=data:application/json,${encodedRouteData}';
			</script>
		</body>
	</html>`;

	return {
		statusCode: 200,
		body,
		headers: { 
			'content-type': 'text/html'
		}
	};
}

async function handleEventsRequest(event) {
	const { isAuthed, headers: { accept }, queryStringParameters: { q = null } = {} } = event;
	if (!q?.match(/\d{4}-\d{2}/)) {
		return {
			statusCode: 400,
			body: JSON.stringify({ error: "q must be provided and in yyyy-MM format" }),
			headers: { 'content-type': 'application/json' },
		};
	}
	const acceptHeader = accept.toLowerCase();

	try {
		const parsed = await getEventsByMonthBenched(event);
		const contentHeader = { 'content-type': acceptHeader === 'text/csv' ? 'text/csv' : 'application/json' };
		return {
			statusCode: 200,
			body: acceptHeader === 'text/csv' ? parsed : JSON.stringify(parsed),
			headers: contentHeader,
		};
	} catch (e) {
		console.error(e);
		return {
			statusCode: 404
		};
	}
}

async function handlePlatesRequest(event) {
	const { isAuthed, headers: { accept } } = event;
  if (!isAuthed) {
    return {
      statusCode: 401
    };
  }

	try {
		const parsed = await getAllEventsByPlateBenched(event);
		const isCsv = accept === 'text/csv';
		return {
			statusCode: 200,
			body: isCsv ? parsed : JSON.stringify(parsed),
			headers: { 'content-type': isCsv ? 'text/csv' : 'application/json' }
		};
	} catch (e) {
		console.error('Failed to load plates', e);
		return {
			statusCode: 400,
			body: JSON.stringify({ error: e.message }),
			headers: { 'content-type': 'application/json' },
		}
	}
}

async function handleYoutubeIdsRequest(event) {
	try {
		const parsed = await getAllYoutubeIdsBenched();
		return {
			statusCode: 200,
			body: JSON.stringify(parsed),
			headers: { 'content-type': 'application/json' }
		};
	} catch (e) {
		return {
			statusCode: 400,
			body: JSON.stringify({ error: e.message }),
			headers: { 'content-type': 'application/json' },
		}
	}
}

async function handleGlobalStatsRequest() {
	try {
		const parsed = await getGlobalStatsBenched();
		return {
			statusCode: 200,
			body: JSON.stringify(parsed),
			headers: { 'content-type': 'application/json' }
		};
	} catch (e) {
		return {
			statusCode: 400,
			body: JSON.stringify({ error: e.message }),
			headers: { 'content-type': 'application/json' },
		}
	}
}

async function handleContentRequest(event) {
	const { isAuthed, rawPath } = event;

	console.log('handle content request', rawPath, event.queryStringParameters);

	let target = `./public/${rawPath}`;
	if (['/', '/oauth', '/routes'].includes(rawPath)) {
		target = './public/index.html';
	}

	if (fs.existsSync(target)) {
		const ext = target.match(/\.(\w+)$/)?.[1];

		let body = await fsPromises.readFile(target, { encoding: 'utf8' });
		let contentType = 'text/plain';

		switch (ext) {
			case 'html':
				contentType = 'text/html';
				break;
			case 'js':
				contentType = 'text/javascript';
				break;
			case 'css':
				contentType = 'text/css';
				break;
		}

		return {
			body,
			statusCode: 200,
			headers: { 'content-type': contentType }
		}
	}

	return {
		statusCode: 404
	}
}

function setJsonContentType(response) {
	const mime = 'application/json';

	if (response.headers) {
		response.headers['content-type'] = mime;
	} else {
		response.headers = { 'content-type': mime };
	}

	return response;
}

function getMissingConfigs(expected) {
	const missingConfigs = [];

	expected.forEach((key) => {
		if (!process.env[key]) {
			missingConfigs.push(key);
		}
	});

	if (missingConfigs.length > 0) {
		return {
			body: `invalid config: [${missingConfigs.join(', ')}]`,
			statusCode: 500,
			'cache-control': 'no-store',
		};
	}
}

async function handleYouTubeThumbnailRequest(event) {
	const { queryStringParameters: { videoId } = {} } = event;

	if (!videoId) {
		throw new Error("Missing query parameter videoId");
	}

	const buffer = await fetch(`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`).then(res => res.arrayBuffer());

	return {
		body: Buffer.from(buffer).toString('base64'),
		headers: { 'content-type': 'image/jpg' },
		isBase64Encoded: true,
		statusCode: 200
	};
}

async function handleSunxDataRequest(event) {
	const { queryStringParameters: { date } = {} } = event;

	if (!date) {
		return setJsonContentType({
			body: JSON.stringify({ error: 'date query parameter is required' }),
			statusCode: 400,
			headers: { 'content-type': 'application/json' },
		});
	}

	if (!date.match(/^\d{4}-\d{2}-\d{2}/)) {
		return setJsonContentType({
			body: JSON.stringify({ error: 'date query parameter must be in format yyyy-MM-dd' }),
			statusCode: 400,
			headers: { 'content-type': 'application/json' },
		});
	}

	try {
		const response = await fetch(`https://api.sunrise-sunset.org/json?lat=${process.env.SUNX_LATITUDE}&lng=${process.env.SUNX_LONGITUDE}&formatted=0&date=${date}`);
		const responseJson = await response.json();

		if (!response.ok) {
			throw new Error(responseJson.status);
		}

		return setJsonContentType({
			body: JSON.stringify(responseJson),
			statusCode: 200,
			headers: { 'content-type': 'application/json' },
		});
	} catch(e) {
		return setJsonContentType({
			body: JSON.stringify({ message: e.message }),
			statusCode: 400,
			headers: { 'content-type': 'application/json' },
		});
	}
}
