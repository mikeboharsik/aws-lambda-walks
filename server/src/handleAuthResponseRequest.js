const jwt = require('jsonwebtoken');
const { DynamoDBClient, GetItemCommand  } = require('@aws-sdk/client-dynamodb');

const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION });

async function handleAuthResponseRequest(event) {
	const publicKey = Buffer.from(process.env.AUTH_PUBLIC_KEY, 'base64').toString();
	const secret = process.env.ACCESS_TOKEN_SECRET;
	const requestDomain = event.requestContext.domainName;

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
				Location: `https://${requestDomain}?authError=User has not been granted access to this application`
			},
		};
	}

	

	const accessToken = jwt.sign({
		iss: `https://${requestDomain}`,
		sub: token.sub,
		aud: token.aud,
	}, secret, { expiresIn: '1h' });

	return {
		statusCode: 302,
		headers: {
			Location: `https://${requestDomain}`,
			'Set-Cookie': `access_token=${accessToken}; Domain=${requestDomain}; HttpOnly; Expires=${((new Date().getTime() / 1000) + (60 * 60)).toUTCString()}`,
		},
	}
}

module.exports = {
	handleAuthResponseRequest,
};
