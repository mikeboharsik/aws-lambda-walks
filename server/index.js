const fs = require('fs');
const fsPromises = require('fs/promises');
const { DynamoDBClient, PutItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb'); // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/index.html
const fetch = require('node-fetch');

const playlistId = process.env.YOUTUBE_PLAYLIST_ID;

exports.handler = async (event) => {
	try {
		const { headers, rawPath } = event;
		event.isAuthed = headers['x-custom-key'] === process.env['X_CUSTOM_KEY'];

		console.log(rawPath);

		let result;

		if (rawPath.startsWith('/api')) {
			result = await handleApiRequest(event);
		} else {
			result = await handleContentRequest(event);
		}

		if (result.body && typeof result.body !== 'string') {
			result.body = JSON.stringify(result.body);
		}

		console.log('Returning result', JSON.stringify(result, null, '  '));

		return result;
	} catch (e) {
		console.error('Unhandled exception:', e);
	}
};

async function handleApiRequest(event) {
	const { isAuthed, rawPath } = event;

	console.log(`handle api request for ${rawPath}`);

	switch (rawPath) {
		case '/api/yt-data': {
			if (!process.env.YOUTUBE_API_KEY || !process.env.AWS_REGION || !process.env.DYNAMO_TABLE_NAME || !process.env.YOUTUBE_PLAYLIST_ID || !process.env.API_KEY_REFERER) {
				return {
					body: 'invalid config',
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

				if (!isAuthed) {
					delete result.playlistid;

					const parsedData = JSON.parse(result.data);
					parsedData.forEach((cur) => {
						delete cur.directions;
						delete cur.videoId;
					});
					result.data = parsedData;
				} else {
					result.data = JSON.parse(result.data);
				}

				return {
					body: result,
					statusCode: 200,
					'cache-control': 'no-store',
				};
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

			const relevantData = items.map(({ snippet: { description, title }, resourceId: { videoId } = {} }) => {
				const date = title.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
				const distance = description.match(/(\d+\.\d+) miles/)?.[1];
				const directions = description.match(/(https:\/\/www\.google\.com\/maps\/.*?)\n/)?.[1] ?? undefined;

				return {
					date,
					directions,
					distance,
					videoId,
				};
			});

			const now = new Date().toISOString()
			const command = new PutItemCommand({
				TableName: process.env.DYNAMO_TABLE_NAME,
				Item: {
					data: { 'S': JSON.stringify(relevantData) },
					datetime: { 'S': now },
					playlistid: { 'S': playlistId },
				}
			});

			await client.send(command);

			if (!isAuthed) {
				relevantData.forEach((cur) => {
					delete cur.directions;
					delete cur.videoId;
				});
			}

			return {
				body: JSON.stringify({ data: relevantData, datetime: now, playlistId: isAuthed ? playlistId : undefined }),
				statusCode: 200,
				'cache-control': 'no-store',
			};
		}

		default: {
			return {
				statusCode: 404,
				'cache-control': 'no-store',
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
			'cache-control': 'no-store',
			headers: {
				'content-type': contentType,
			}
		}
	}

	return {
		statusCode: 404,
		'cache-control': 'no-store',
	}
}
