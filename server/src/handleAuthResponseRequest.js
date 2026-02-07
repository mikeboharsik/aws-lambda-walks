const jwt = require('jsonwebtoken');

async function handleAuthResponseRequest(event) {
	const origin = process.env.PUBLIC_HOST;
	const publicKey = Buffer.from(process.env.AUTH_PUBLIC_KEY, 'base64').toString();
	const secret = process.env.ACCESS_TOKEN_SECRET;

	const cookies = event.cookiesParsed;
	if (!cookies?.id_token) {
		return {
			statusCode: 400,
		};
	}
	
	const token = jwt.verify(cookies.id_token, publicKey, { algorithm: 'RS256' });

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
			`id_token=; Domain=${origin}; HttpOnly; Expires=${new Date().toUTCString()}`
		],
		headers: {
			Location: `https://${origin}`,
		},
	}
}

module.exports = {
	handleAuthResponseRequest,
};
