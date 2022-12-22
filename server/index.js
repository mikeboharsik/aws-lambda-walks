// look into using https://www.npmjs.com/package/aws-lambda-router

const fs = require('fs');
const fsPromises = require('fs/promises');
const { DynamoDBClient, PutItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb'); // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/index.html
const fetch = require('node-fetch');

const playlistId = process.env.YOUTUBE_PLAYLIST_ID;

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
				delete walk.videoId;
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

	switch (rawPath) {
		case '/api/yt-data': {
			return await handleYouTubeDataRequest(event);
		}

		case '/api/sunset': {
			return await handleSunsetDataRequest(event);
		}

		default: {
			return {
				statusCode: 404
			};
		}
	}	
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

async function handleYouTubeDataRequest(event) {
	const { isAuthed } = event;

	const expectedConfigs = [
		'API_KEY_REFERER',
		'AWS_REGION',
		'DYNAMO_TABLE_NAME',
		'YOUTUBE_API_KEY',
		'YOUTUBE_PLAYLIST_ID',
	];

	const missingConfigs = [];

	expectedConfigs.forEach((key) => {
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

	const oneHourAgo = new Date();
	oneHourAgo.setHours(oneHourAgo.getHours() - 1);

	const client = new DynamoDBClient({ region: process.env.AWS_REGION });
	const query = new QueryCommand({
		TableName: process.env.DYNAMO_TABLE_NAME,
		ExpressionAttributeNames: {
			'#datetime': 'datetime'
		},
		ExpressionAttributeValues: {
			':playlistid': { 'S': playlistId },
			':datetime': { 'S': oneHourAgo.toISOString() }
		},
		KeyConditionExpression: 'playlistid = :playlistid and #datetime >= :datetime'
	});

	const { Count, Items } = await client.send(query);

	if (Count > 0) {
		console.log('returning cached data');

		let [result] = Items;

		result = Object.entries(result).reduce((acc, [k, v]) => { acc[k] = v.S; return acc; }, {})

		return setJsonContentType({
			body: formatYouTubeDataResponse(result, isAuthed),
			statusCode: 200
		});
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

		const date = title.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
		const distance = description.match(/(\d+\.\d+) miles/)?.[1];
		const directions = description.match(/(https:\/\/www\.google\.com\/maps\/.*?)(\n|$)/)?.[1] ?? undefined;

		return {
			date,
			directions,
			distance,
			videoId,
		};
	});

	const normalized = relevantData.reduce((acc, { date, directions, distance, videoId }) => {
		const exists = acc.find(d => d.date === date);
		if (exists) {
			exists.walks.push({ directions, distance, videoId });
		} else {
			acc.push({ date, walks: [{ directions, distance, videoId }] });
		}

		return acc;
	}, []);

	const now = new Date().toISOString()
	const body = {
		data: JSON.stringify(normalized),
		datetime: now,
		playlistId // whether this is included in the response will be handled by the formatter function below
	};
	
	const command = new PutItemCommand({
		TableName: process.env.DYNAMO_TABLE_NAME,
		Item: {
			data: { 'S': body.data },
			datetime: { 'S': now },
			playlistid: { 'S': body.playlistId },
		}
	});

	if (!Boolean(process.env.READONLY)) {
		console.log(`Storing update in DynamoDB using command:\n${JSON.stringify(command)}`)
		await client.send(command);
	} else {
		console.log(`process.env.READONLY is [${process.env.READONLY}], skipping DyanmoDB update`);
	}

	return setJsonContentType({
		body: formatYouTubeDataResponse(body, isAuthed),
		statusCode: 200
	});
}

async function handleSunsetDataRequest(event) {
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
