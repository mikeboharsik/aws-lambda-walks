const jwt = require('jsonwebtoken');

const authUrl = process.env.AUTH_URL;

async function authenticate(event) {
  let token;
	try {
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
			console.error('Failed to verify JWT', e);
		}

		if (!verified.scope.includes('walks.read')) {
			console.log('Expected token scope to include walks.read but was', verified.scope);
			verified = false;
		}

		if (verified) {
			event.isAuthed = true;
			event.authExpires = new Date(verified.exp * 1000).toUTCString();
		} else {
      console.log('Authentication failed', authUrl, event.headers.authorization);
    }
	} catch (e) {
    console.error('Something went wrong during authentication', e, token);
  }
}

module.exports = {
	authenticate
};
