const jwt = require('jsonwebtoken');
const { DynamoDBClient, GetItemCommand  } = require('@aws-sdk/client-dynamodb');

const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION });

async function handleAuthResponseRequest(event) {
	const origin = process.env.PUBLIC_HOST;
	const publicKey = Buffer.from(process.env.AUTH_PUBLIC_KEY, 'base64').toString();
	const secret = process.env.ACCESS_TOKEN_SECRET;

	const { queryStringParameters: { id_token } = {} } = event;

	const token = jwt.verify(id_token, publicKey, { algorithm: 'RS256' });

	const command = new GetItemCommand({
		TableName: 'walks-users',
		Key: {
			username: {
				S: token.sub,
			},
		}
	});
	const response = await dbClient.send(command);
	if (!response.Item) {
		return {
			statusCode: 302,
			headers: {
				Location: `https://${origin}?authError=${encodeURIComponent('User has not been granted access to this application')}`
			},
		};
	}

	const accessToken = jwt.sign({
		iss: `https://${origin}`,
		sub: token.sub,
		aud: token.aud,
		scope: 'walks.read',
	}, secret, { expiresIn: '1h' });

	const nowMs = new Date().getTime();
	const expirationDate = new Date(nowMs + (1000 * 60 * 60));

	return {
		statusCode: 302,
		cookies: [
			`access_token=${accessToken}; Domain=${origin}; HttpOnly; Expires=${expirationDate.toUTCString()}`,
			`access_token_valid_until=${expirationDate.getTime()}; Domain=${origin}; Expires=${expirationDate.toUTCString()}`,
		],
		headers: {
			Location: `https://${origin}`,
		},
	}
}

module.exports = {
	handleAuthResponseRequest,
};
