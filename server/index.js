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
	return JSON.parse(await fsPromises.readFile('./events.json'));
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

	const parsed = await getAllEvents();
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

	let target = null;
	if (q) {
		const parts = q.split('-');
		target = parts.filter(e => e).join('-');
	}

	const parsed = await getAllEvents();
	console.log({ parsed });
	let results = parsed;
	if (target) {
		results = parsed.filter(e => e.date.match(target));
	}

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

	const parsed = await getAllEvents();

	const results = parsed.reduce((acc, dayWalk) => {
		const { date, events, youtubeId } = dayWalk;

		events?.forEach(({ name, plate, trimmedStart }) => {
			plate = plate
				?.replace('SKIP', '')
				?.replace('OOB ', '')
				?.replace('TINT', '')
				?.replace(/ /g, '');
			if (plate) {
				if (!q || (q && plate.match(q))) {
					name = name
						?.replace('SKIP', '')
						?.replace('OOB ', '');

					const entry = { date, name };
					if (youtubeId) {
						if (trimmedStart) {
							const [hours, minutes, seconds] = trimmedStart.split(':').map(e => parseInt(e));
							const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
							entry.link = `https://youtu.be/${youtubeId}?t=${totalSeconds}`;
						} else {
							entry.link = `https://youtu.be/${youtubeId}`;
						}
					}

					if (acc[plate]) {
						acc[plate].push(entry);
					} else {
						acc[plate] = [entry];
					}
				}
			}
		});

		return acc;
	}, {});

	const copy = {};
	const keys = Object.keys(results);
	keys.sort();
	keys.forEach((key) => {
		copy[key] = results[key];
	});

	/*
	if (!isAuthed) {
		makeEventsSafeForUnauthed(results);
	}
	*/

	return {
		statusCode: 200,
		body: JSON.stringify(copy),
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
