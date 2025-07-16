const jwt = require('jsonwebtoken');

const authUrl = process.env.AUTH_URL;

function verifyToken(event) {
	const publicKey = Buffer.from(process.env.AUTH_PUBLIC_KEY, 'base64').toString();
	const [, token = null] = event.headers?.authorization?.split('Bearer ') ?? [];

	let verified = false;
	try {
		if (token) {
			verified = jwt.verify(token, publicKey, { algorithm: 'RS256' });
		} else {
			const { queryStringParameters: { jwt: queryJwt } = {} } = event;
			if (queryJwt) {
				verified = jwt.verify(queryJwt, publicKey, { algorithm: 'RS256' });
			}
		}
		console.log('Authenticated user:', verified?.sub);
	} catch (e) {
		console.error('Failed to verify JWT', e, token);
	}
	return verified;
}

function verifyScope(token) {
	const result = token.scope.includes('walks.read');
	if (!result) console.log('Expected token scope to include walks.read but was', token.scope);
	return result;
}

async function authenticate(event) {
	try {
		let verified = verifyToken(event);
		verified &&= verifyScope(verified);
		if (verified) {
			event.isAuthed = true;
			event.authSubject = verified.sub;
			event.authExpires = new Date(verified.exp * 1000).toUTCString();
			event.authScope = verified.scope;
		} else {
      console.log('Authentication failed', authUrl, event.headers.authorization);
    }
	} catch (e) {
    console.error('Something went wrong during authentication', e);
  }
}

module.exports = {
	authenticate
};
