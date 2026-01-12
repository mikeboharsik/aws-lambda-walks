const jwt = require('jsonwebtoken');

const authUrl = process.env.AUTH_URL;

function verifyToken(event) {
	const secret = process.env.ACCESS_TOKEN_SECRET;
	const token = event.cookiesParsed.access_token;

	let verified = false;
	try {
		if (token) {
			verified = jwt.verify(token, secret, { algorithm: 'RS256' });
			event.log('Authenticated user:', verified?.sub);
		}
	} catch (e) {
		event.logError('Failed to verify JWT', e, token);
	}
	return verified;
}

function verifyScope(token, event) {
	const result = token.scope?.includes('walks.read');
	if (!result) {
		event.log('Expected token scope to include walks.read but was', token.scope);
		throw new Error('Invalid scope');
	}
	return token;
}

async function authenticate(event) {
	try {
		let verified = verifyToken(event);
		verified &&= verifyScope(verified, event);
		if (verified) {
			event.isAuthed = true;
			event.authSubject = verified.sub;
			event.authExpires = new Date(verified.exp * 1000).toUTCString();
			event.authScope = verified.scope;
		} else {
      event.log(`Authentication failed, authUrl: [${authUrl}], authorization header: [${event.headers?.authorization}]`);
    }
	} catch (e) {
    event.logError('Something went wrong during authentication', e);
  }
}

module.exports = {
	authenticate
};
