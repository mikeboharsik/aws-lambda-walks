// look into using https://www.npmjs.com/package/aws-lambda-router

const fs = require('fs');
const fsPromises = require('fs/promises');

const fetch = require('node-fetch');

const playlistId = process.env.YOUTUBE_PLAYLIST_ID;

const minuteInSeconds = 60;
const hourInSeconds = minuteInSeconds * 60;
const dayInSeconds = hourInSeconds * 24;
const yearInSeconds = dayInSeconds * 365;

const routeCacheValues = {
	'/api/yt-data': `max-age=${hourInSeconds}`,
};

function authenticate(event) {
	const { headers } = event;
	const xCustomKey = process.env['X_CUSTOM_KEY'];
	event.isAuthed = xCustomKey && headers['x-custom-key'] === xCustomKey;
}

function verifyBodyIsString(result) {
	if (result.body && typeof result.body !== 'string') {
		result.body = JSON.stringify(result.body);
	}
}

function verifyCacheValue(result, rawPath) {
	if (!result['cache-control']) {
		if (routeCacheValues[rawPath]) {
			const cacheValue = routeCacheValues[rawPath];
			result['cache-control'] = cacheValue;
		} else {
			result['cache-control'] = `max-age=${yearInSeconds}`;
		}
		console.log(`Set cache-control header to [${result['cache-control']}]`);
	}
}

function logResult(result) {
	if (Boolean(process.env['LOG_RESULT'])) {
		console.log('Returning result', JSON.stringify(result, null, '  '));
	}
}

exports.handler = async (event) => {
	try {
		const { rawPath } = event;
		if (Boolean(process.env['LOG_RAW_PATH'])) {
			console.log(rawPath);
		}

		authenticate(event);

		const isApiRequest = rawPath.startsWith('/api');
		const handlerFunction = isApiRequest ? handleApiRequest : handleContentRequest;

		const result = await handlerFunction(event);

		verifyBodyIsString(result);
		verifyCacheValue(result, rawPath);
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
		delete result.playlistid;

		const parsedData = JSON.parse(result.data);
		parsedData.forEach((cur) => {
			cur.walks.forEach(walk => {
				delete walk.directions;
				delete walk.route;
			});
		});
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
	};

	const func = routeMap[rawPath] ?? async function() { return { statusCode: 404 }; };

	return await func(event);
}

async function handleContentRequest(event) {
	const { isAuthed, rawPath } = event;

	console.log('handle content request', rawPath);

	let target = `./public/${rawPath}`;
	if (rawPath === '/') {
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
					parsed.features.forEach((feature) => {
						if (feature.properties.isPrivate) {
							delete feature.geometry;
						}

						delete feature.properties.isPrivate;
						delete feature.properties.name;
						delete feature.properties.path;
					});
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
		const distance = description.match(/(\d+\.\d+) miles/)?.[1] ?? null;
		const directions = description.match(/(https:\/\/www\.google\.com\/maps\/.*?)(\n|$)/)?.[1] ?? null;
		const routeId = description.match(/Route: (.*)/)?.[1] ?? null;

		return {
			date,
			directions,
			distance,
			routeId,
			videoId,
		};
	});

	const normalized = relevantData.reduce((acc, { date, directions, distance, routeId, videoId }) => {
		if (date) {
			const exists = acc.find(d => d.date === date);
			if (exists) {
				exists.walks.push({ directions, distance, routeId, videoId });
			} else {
				acc.push({ date, walks: [{ directions, distance, routeId, videoId }] });
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

	const buffer = await fetch(`https://i.ytimg.com/vi/${videoId}/default.jpg`).then(res => res.arrayBuffer());

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
				console.log('Invalidate cached YouTube data here');
			} else {
				console.log('Updated an old video, no reason to invalidate the cache');
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
