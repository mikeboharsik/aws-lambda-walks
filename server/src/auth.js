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
			console.log('Authenticated user:', verified?.username);
		} catch (e) {
			console.error('Failed to verify JWT', e);
		}

		if (verified) {
			event.isAuthed = true;
			
			const [, content] = token.split('.').slice(0, 2).map(e => JSON.parse(Buffer.from(e, 'base64').toString()));
			event.authExpires = new Date(content.exp * 1000).toUTCString();
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
