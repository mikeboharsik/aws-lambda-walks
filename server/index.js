// look into using https://www.npmjs.com/package/aws-lambda-router

const fs = require('fs');
const fsPromises = require('fs/promises');
const { DynamoDBClient, PutItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb'); // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/index.html
const fetch = require('node-fetch');

const playlistId = process.env.YOUTUBE_PLAYLIST_ID;

exports.handler = async (event) => {
	try {
		const { headers, rawPath } = event;
		event.isAuthed = headers['x-custom-key'] === process.env['X_CUSTOM_KEY'];

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

		return {
			body: JSON.stringify({ message: e.message }),
			statusCode: 500,
		}
	}
};

async function handleApiRequest(event) {
	const { isAuthed, rawPath, queryStringParameters } = event;

	console.log(`handle api request for ${rawPath}`);

	switch (rawPath) {
		case '/api/sunset': {
			let dateStr;
			if (queryStringParameters?.date) {
				dateStr = queryStringParameters.date;
			} else {
				throw new Error('A date must be specified');
			}			

			let url = `https://www.google.com/search?q=sunset+stoneham%2C+ma+${dateStr}`;
			const res = await fetch(url).then(res => res.text());

			const [time] = res.match(/\d{1,2}:\d{2} [AP]M/g);

			return {
				body: time,
				statusCode: 200,
			}
		}

		case '/api/yt-data': {
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
			const command = new PutItemCommand({
				TableName: process.env.DYNAMO_TABLE_NAME,
				Item: {
					data: { 'S': JSON.stringify(normalized) },
					datetime: { 'S': now },
					playlistid: { 'S': playlistId },
				}
			});

			await client.send(command);

			if (!isAuthed) {
				normalized.forEach((cur) => {
					cur.walks.forEach(walk => {
						delete walk.directions;
						delete walk.videoId;
					});
				});
			}

			return {
				body: JSON.stringify({ data: normalized, datetime: now, playlistId: isAuthed ? playlistId : undefined }),
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
