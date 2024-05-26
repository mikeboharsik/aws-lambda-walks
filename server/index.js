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
		await fetch(authUrl, { headers: { authorization: event.headers.authorization }});
		event.isAuthed = true;

		const [, token] = event.headers.authorization.split('Bearer ');
		const [, content] = token.split('.').slice(0, 2).map(e => JSON.parse(Buffer.from(e, 'base64').toString()));
		event.authExpires = content.exp;
	} catch { }
}

function verifyBodyIsString(result) {
	if (result.body && typeof result.body !== 'string') {
		result.body = JSON.stringify(result.body);
	}
}

function verifyCacheValue(event, result, rawPath) {
	if (!result['cache-control']) {
		if (event.authExpires) {
			const maxAge = event.authExpires - Math.floor(new Date().getTime() / 1000);
			result['cache-control'] = `max-age=${maxAge}`;
		} else {
			if (routeCacheValues[rawPath]) {
				const cacheValue = routeCacheValues[rawPath];
				result['cache-control'] = `max-age=${cacheValue}`;
			} else {
				result['cache-control'] = `max-age=${yearInSeconds}`;
			}
		}
		console.log(`Set cache-control header to [${result['cache-control']}]`);
	}
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
		type: "FeatureCollection",
		features: [
			{
				type: "Feature",
				properties: {},
				geometry: {
					type: "LineString",
					coordinates,
				}
			}
		]
	};
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

function formatYouTubeDataResponse(result, isAuthed = false) {
	if (!isAuthed) {
		delete result.playlistId;

		const parsedData = JSON.parse(result.data);
		result.data = parsedData;
	}

	if (typeof result.data === 'string') {
		result.data = JSON.parse(result.data);
	}

	return result;
}

async function handleApiRequest(event) {
	const { rawPath } = event;

	console.log(`handle api request for ${rawPath}`);

	const routeMap = {
		'/api/yt-data': handleYouTubeDataRequest,
		'/api/sunx': handleSunxDataRequest,
		'/api/yt-thumbnail': handleYouTubeThumbnailRequest,
		'/api/webhooks/video': handleWebhookVideo,
		'/api/route': handleWalkRouteRequest,
		'/api/events': handleEventsRequest,
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
	const { isAuthed, queryStringParameters: { date, id } } = event;

	if (!date && !id) {
		return {
			statusCode: 400,
		};
	}

	const [geojson, events] = await Promise.all([
		fsPromises.readFile('./public/geo.json', { encoding: 'utf8' }),
		fsPromises.readFile('./public/events.json', { encoding: 'utf8' })
	]);

	let route;

	if (date) {
		route = events.find(e => e.date === date);
	} else {
		route = geojson.features.find(f => f.properties.id === id);
	}

	if (!route) {
		return {
			statusCode: 404,
		};
	}

	if (!isAuthed) {
		makeFeatureSafeForUnauthed(route);
	}

	const updatedRouteData = {
		type: "FeatureCollection",
		features: [],
	};

	if (date) {
		const feature = {
			type: "Feature",
			geometry: {
				coordinates: [],
				type: "LineString"
			}
		};
		feature.coordinates = route.coords.map(coord => [coord.lat, coord.lon]);
		updatedRouteData.features = [feature];
	} else {
		updatedRouteData.features.push(route);
		route.properties.commonFeatureIds?.forEach((fid) => {
			const feature = geojson.features.find(r => r.properties.id === fid);
			if (feature?.geometry) {
				if (!isAuthed) {
					makeFeatureSafeForUnauthed(feature);
				}
				updatedRouteData.features.push(feature);
			}
		});
	}

	const encodedRouteData = encodeURIComponent(JSON.stringify(updatedRouteData));

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
	};
}

async function handleEventsRequest(event) {
	const { isAuthed, queryStringParameters: { q } } = event;

	const parts = q.split('-');
	const target = parts.filter(e => e).join('-');

	const allFiles = fs.readdirSync('./events');

	const targetFiles = allFiles.filter(e => e.match(target));

	const reads = targetFiles.map(e => fs.promises.readFile(`./events/${e}`, { encoding: 'utf8' }));

	const results = (await Promise.all(reads)).map(e => {
		let result = JSON.parse(e);

		result.geo = getGeoJsonFromCoords(result.coords, isAuthed);

		return result;
	});

	if (!isAuthed) {
		makeEventsSafeForUnauthed(results);
	}

	return {
		statusCode: 200,
		body: JSON.stringify(results),
	};
}

async function handleContentRequest(event) {
	const { isAuthed, rawPath } = event;

	console.log('handle content request', rawPath);

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
			case 'json':
				contentType = 'application/json';

				if (rawPath.endsWith('geo.json') && !isAuthed) {
					const parsed = JSON.parse(body);
					parsed.features.forEach(makeFeatureSafeForUnauthed);
					body = JSON.stringify(parsed);
				}
				if (rawPath.endsWith('events.json' && !isAuthed)) {
					const parsed = JSON.parse(body);
					parsed.forEach(makeEventsSafeForUnauthed);
					body = JSON.stringify(parsed);
				}
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

async function handleYouTubeDataRequest(event) {
	const { isAuthed } = event;

	const expectedConfigs = [
		'API_KEY_REFERER',
		'YOUTUBE_API_KEY',
		'YOUTUBE_PLAYLIST_ID',
	];

	const missingConfigsResponse = getMissingConfigs(expectedConfigs);
	if (missingConfigsResponse) {
		return missingConfigsResponse;
	}

	const baseUri = 'https://www.googleapis.com/youtube/v3/playlistItems';
	const params = {
		key: process.env.YOUTUBE_API_KEY,
		maxResults: 50,
		part: 'snippet',
		playlistId,
	};

	let items = [];
	do {
		const uri = `${baseUri}?${Object.entries(params).map(([k, v]) => k + '=' + v).join('&')}`;

		const res = await fetch(uri, { headers: { 'Referer': process.env.API_KEY_REFERER } }).then(r => r.json());

		items = items.concat(res.items);

		params.pageToken = res.nextPageToken;
	} while(params.pageToken);

	const relevantData = items.map((item) => {
		const { snippet: { description, resourceId: { videoId }, title } } = item;

		const date = title.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
		const routeId = description.match(/Route: (.*)/)?.[1] ?? null;

		return {
			date,
			routeId,
			videoId,
		};
	});

	const normalized = relevantData.reduce((acc, { date, routeId, videoId }) => {
		if (date) {
			const exists = acc.find(d => d.date === date);
			if (exists) {
				exists.walks.push({ routeId, videoId });
			} else {
				acc.push({ date, walks: [{ routeId, videoId }] });
			}
		}

		return acc;
	}, []);

	const now = new Date().toISOString()
	const body = {
		data: JSON.stringify(normalized),
		datetime: now,
		playlistId // whether this is included in the response will be handled by the formatter function below
	};

	return setJsonContentType({
		body: formatYouTubeDataResponse(body, isAuthed),
		statusCode: 200
	});
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

// https://pubsubhubbub.appspot.com/subscribe
async function handleWebhookVideo(event) {
	const {
		body,
		queryStringParameters: {
			'hub.topic': topic,
			'hub.challenge': challenge,
			'hub.mode': mode,
			'hub.lease_seconds': lease_seconds
		} = {}
	} = event;

	if (mode) {
		console.log(`Received webhook ${mode} request`, JSON.stringify({ topic, challenge, mode, lease_seconds }));
	} else if (body) {
		console.log('Webhook body', event.body);

		let shouldInvalidateYouTubeDataAfter = new Date();
		shouldInvalidateYouTubeDataAfter.setHours(shouldInvalidateYouTubeDataAfter.getHours() - 1);

		let [,videoPublishedAt] = body.match(/<published>(.*?)<\/published>/);
		if (videoPublishedAt) {
			videoPublishedAt = new Date(videoPublishedAt);

			if (videoPublishedAt >= shouldInvalidateYouTubeDataAfter) {
				const cfInput = {
					DistributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
					InvalidationBatch: {
						CallerReference: new Date().getTime().toString(),
						Paths: {
							Items: ['/api/yt-data'],
							Quantity: 1,
						}
					}
				};
				const cfClient = new CloudFrontClient({ region: process.env.AWS_REGION });
				const cfCommand = new CreateInvalidationCommand(cfInput);
	
				console.log(`Invalidating CloudFront cache using command:\n${JSON.stringify(cfCommand)}`);
				const result = await cfClient.send(cfCommand);
				console.log('Invalidation result', JSON.stringify(result));

				return {
					body: 'did update',
					statusCode: 200,
					'cache-control': 'no-store,max-age=0',
				};
			} else {
				console.log('Updated an old video, no reason to invalidate the cache');

				return {
					body: 'no update',
					statusCode: 200,
					'cache-control': 'no-store,max-age=0',
				};
			}
		}
	} else {
		console.error('Did not find expected data in the webhook request payload', JSON.stringify(event));
	}

	return {
		body: challenge,
		statusCode: 200,
		'cache-control': 'no-store,max-age=0',
	};
}
