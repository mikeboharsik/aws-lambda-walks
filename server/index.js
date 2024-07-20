// look into using https://www.npmjs.com/package/aws-lambda-router

const fs = require('fs');
const fsPromises = require('fs/promises');
const geolib = require('geolib');

const { CloudFrontClient, CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');

const fetch = require('node-fetch');

const playlistId = process.env.YOUTUBE_PLAYLIST_ID;
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
	try {
		const res = await fetch(authUrl, { headers: { authorization: event.headers.authorization }});

		if (res.ok) {
			event.isAuthed = true;
			const [, token] = event.headers.authorization.split('Bearer ');
			const [, content] = token.split('.').slice(0, 2).map(e => JSON.parse(Buffer.from(e, 'base64').toString()));
			event.authExpires = content.exp;
		}
	} catch { }
	console.log({ isAuthed: !!event.authExpires });
}

function verifyBodyIsString(result) {
	if (result.body && typeof result.body !== 'string') {
		result.body = JSON.stringify(result.body);
	}
}

function verifyCacheValue(event, result, rawPath) {
	if (event.authExpires) {
		const nowInSeconds = Math.floor(new Date().getTime() / 1000);
		const maxAge = Math.max(0, event.authExpires - nowInSeconds);
		console.log(JSON.stringify({ authExpires: event.authExpires, nowInSeconds, maxAge }));
		result['cache-control'] = `max-age=${maxAge}`;
	}	else if (!result['cache-control']) {
		if (routeCacheValues[rawPath]) {
			const cacheValue = routeCacheValues[rawPath];
			result['cache-control'] = `max-age=${cacheValue}`;
		} else {
			result['cache-control'] = `max-age=${yearInSeconds}`;
		}
	}
	console.log(`Set cache-control header to [${result['cache-control']}]`);
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

function makeEventsSafeForUnauthed(events) {
	for (let e of events) {
		delete e.coords;
		delete e.events;
		delete e.exif;
	}
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

async function getAllEvents() {
	const s = new Date().getTime();
	const result = JSON.parse(await fsPromises.readFile('./events.json'));
	console.log(`getAllEvents completed in ${new Date().getTime() - s} ms`);
	return result;
}

async function getEventsByMonth(month) {
	const s = new Date().getTime();
	const result = JSON.parse(await fsPromises.readFile(`./walks/${month}.json`));
	console.log(`getEventsByMonth completed in ${new Date().getTime() - s} ms`);
	return result;
}

async function getCoordsByMonth(month) {
	const s = new Date().getTime();
	const result = JSON.parse(await fsPromises.readFile(`./coords/${month}.json`));
	console.log(`getCoordsByMonth completed in ${new Date().getTime() - s} ms`);
	return result;
}

async function getAllEventsByPlate() {
	const s = new Date().getTime();
	const result = JSON.parse(await fsPromises.readFile(`./plates/plates.json`));
	console.log(`getAllEventsByPlate completed in ${new Date().getTime() - s} ms`);
	return result;
}

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

		const result = await handlerFunction(event);

		verifyBodyIsString(result);
		verifyCacheValue(event, result, rawPath);
		logResult(result);

		return result;
	} catch (e) {
		console.error('Unhandled exception:', e);

		return setJsonContentType({
			body: JSON.stringify({ message: e.message }),
			statusCode: 500,
		});
	}
};

async function handleApiRequest(event) {
	const { rawPath } = event;

	console.log(`handle api request for ${rawPath}`);

	const routeMap = {
		'/api/sunx': handleSunxDataRequest,
		'/api/yt-thumbnail': handleYouTubeThumbnailRequest,
		'/api/routes': handleWalkRouteRequest,
		'/api/events': handleEventsRequest,
		'/api/plates': handlePlatesRequest,
		'/api/invalidateCache': handleCacheInvalidate,
	};

	const func = routeMap[rawPath] ?? async function() { return { statusCode: 404 }; };

	return await func(event);
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
			body: 'paths is missing from the request body'
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

	if (!date) {
		return {
			statusCode: 400,
		};
	}

	if (!date.match(/\d{4}-\d{2}-\d{2}/)) {
		return {
			statusCode: 400,
		};
	}

	const [month] = date.match(/\d{4}-\d{2}/);

	const parsed = await getCoordsByMonth(month);
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
	const { isAuthed, queryStringParameters: { q = null } = {} } = event;

	if (!q.match(/\d{4}-\d{2}/)) {
		throw new Error("Query must be in yyyy-MM format");
	}

	const parsed = await getEventsByMonth(q);
	let results = parsed;

	if (!isAuthed) {
		makeEventsSafeForUnauthed(results);
	}

	return {
		statusCode: 200,
		body: JSON.stringify(results),
		headers: {
			'content-type': 'application/json'
		}
	};
}

async function handlePlatesRequest(event) {
	const { isAuthed, queryStringParameters: { q = null } = {} } = event;

	const parsed = await getAllEventsByPlate();

	return {
		statusCode: 200,
		body: JSON.stringify(parsed),
		headers: { 'content-type': 'application/json' }
	};
}

async function handleContentRequest(event) {
	const { isAuthed, rawPath } = event;

	console.log('handle content request', rawPath, event.queryStringParameters);

	let target = `./public/${rawPath}`;
	if (['/', '/routes'].includes(rawPath)) {
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
			headers: {
				'content-type': contentType,
			}
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
			body: JSON.stringify({ message: 'date query parameter is required' }),
			statusCode: 400
		});
	}

	if (!date.match(/^\d{4}-\d{2}-\d{2}/)) {
		return setJsonContentType({
			body: JSON.stringify({ message: 'date query parameter must be in format yyyy-MM-dd' }),
			statusCode: 400
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
		});
	} catch(e) {
		return setJsonContentType({
			body: JSON.stringify({ message: e.message }),
			statusCode: 400,
		});
	}
}
