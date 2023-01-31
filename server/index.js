// look into using https://www.npmjs.com/package/aws-lambda-router

const fs = require('fs');
const fsPromises = require('fs/promises');
const zlib = require('zlib');
const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb'); // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/index.html
const fetch = require('node-fetch');

const playlistId = process.env.YOUTUBE_PLAYLIST_ID;

const awsConfig = { region: process.env.AWS_REGION };

exports.handler = async (event) => {
	try {
		const { headers, rawPath } = event;
		const xCustomKey = process.env['X_CUSTOM_KEY'];
		event.isAuthed = xCustomKey && headers['x-custom-key'] === xCustomKey;

		if (Boolean(process.env['LOG_RAW_PATH'])) {
			console.log(rawPath);
		}

		let result;

		if (rawPath.startsWith('/api')) {
			result = await handleApiRequest(event);
		} else {
			result = await handleContentRequest(event);
		}

		if (result.body && typeof result.body !== 'string') {
			result.body = JSON.stringify(result.body);
		}

		if (Boolean(process.env['LOG_RESULT'])) {
			console.log('Returning result', JSON.stringify(result, null, '  '));
		}

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
		'/api/routes': handleWalkRoutesRequest,
		'/api/sunx': handleSunxDataRequest,
		'/api/yt-thumbnail': handleYouTubeThumbnailRequest,
	};

	const func = routeMap[rawPath] ?? async function() { return { statusCode: 404 }; };

	return await func(event);
}

async function handleContentRequest(event) {
	const { rawPath } = event;

	console.log('handle content request', rawPath);

	let target = `./public/${rawPath}`;
	if (rawPath === '/') {
		target = './public/index.html';
	}

	if (fs.existsSync(target)) {
		const ext = target.match(/\.(\w+)/)?.[1];

		let body;
		let contentType = 'text/plain';

		switch (ext) {
			case 'html':
				body = await fsPromises.readFile(target, { encoding: 'utf8' });
				contentType = 'text/html';
				break;
			case 'json':
				body = await fsPromises.readFile(target, { encoding: 'utf8' });
				contentType = 'application/json';
				break;
			case 'js':
				body = await fsPromises.readFile(target, { encoding: 'utf8' });
				contentType = 'text/javascript';
				break;
			case 'css':
				body = await fsPromises.readFile(target, { encoding: 'utf8' });
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

async function handleWalkRoutesRequest(event) {
	const expectedConfigs = [
		'DYNAMO_ROUTES_TABLE_NAME'
	];

	const missingConfigsResponse = getMissingConfigs(expectedConfigs);
	if (missingConfigsResponse) {
		return missingConfigsResponse;
	}

	const { isAuthed } = event;

	const client = new DynamoDBClient(awsConfig);

	const commandAttributes = { TableName: process.env.DYNAMO_ROUTES_TABLE_NAME };

	if (!isAuthed) {
		commandAttributes.ProjectionExpression = 'id, realmiles';
	}

	const command = new ScanCommand(commandAttributes);

	console.log('Using command', JSON.stringify(command));

	const { Items } = await client.send(command);

	const result = Items.reduce((acc, cur) => {
		const item = {};

		Object.keys(cur).forEach((key) => {
			const type = Object.keys(cur[key])[0];
			const rawValue = cur[key][type];

			if (key === 'geojson') {
				if (isAuthed) {
					item[key] = JSON.parse(zlib.inflateSync(Buffer.from(rawValue, 'base64')).toString());
				}
			} else {
				item[key] = type === 'N' ? parseFloat(rawValue) : rawValue;
			}
		});

		acc.push(item);
		return acc;
	}, []);

	return setJsonContentType({
		body: JSON.stringify(result),
		statusCode: 200,
	})
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
		const response = await fetch(`https://api.sunrise-sunset.org/json?lat=42.49940760476378&lng=-71.09927545831746&formatted=0&date=${date}`);
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
