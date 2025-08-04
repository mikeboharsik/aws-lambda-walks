require('./setupLoggers.js');

const { authenticate } = require('./auth.js');
const { handleApiRequest } = require('./handleApiRequest.js');
const { handleAuthResponseRequest } = require('./handleAuthResponseRequest.js');
const { handleContentRequest } = require('./handleContentRequest.js');
const { verifyCacheValue } = require('./verifyCacheValue.js');
const { setJsonContentType } = require('./setJsonContentType.js');
const { verifyBodyIsString } = require('./verifyBodyIsString.js');

function logResult(result) {
	if (process.env['LOG_RESULT'] === 'true') {
		console.log('Returning result', JSON.stringify(result, null, '  '));
	}
}

function logEvent(event) {
	const copy = JSON.parse(JSON.stringify(event));
	copy.cookies?.forEach((cookie, idx) => {
		if (cookie.startsWith('access_token')) {
			const [k, v] = cookie.split('=');
			if (k === 'access_token') {
				const newCookie = k + '=' + v.slice(0, 10) + '...' + v.slice(-10);
				copy.cookies.splice(idx, 1, newCookie);
			}
		}
	});
	console.log(JSON.stringify(copy));
}

exports.handler = async (event, ignoreAuth = false) => {
	try {
		logEvent(event);

		const { rawPath } = event;
		if (Boolean(process.env['LOG_RAW_PATH'])) {
			console.log(rawPath);
		}

		try {
			if (event.body) {
				event.body = JSON.parse(atob(event.body));
			}
		} catch (e) {
			console.warn('Body seems to exist but it failed to parse', e);
		}

		if (ignoreAuth === true) {
			event.isAuthed = true;
		} else if (event.cookies) {
			await authenticate(event);
		}

		const isApiRequest = rawPath.startsWith('/api');
		const isAuthResponseRequest = rawPath.startsWith('/authresp');
		const handlerFunction = isAuthResponseRequest ? handleAuthResponseRequest : isApiRequest ? handleApiRequest : handleContentRequest;

		let result = await handlerFunction(event);
		if (!result.statusCode) {
			throw new Error(`The result returned has an incorrect format: ${JSON.stringify(result)}`);
		}

		verifyBodyIsString(result);
		verifyCacheValue(event, result, rawPath);
		logResult(result);

		return result;
	} catch (e) {
		console.error('Unhandled exception:', e);

		return setJsonContentType({
			statusCode: 500,
			body: JSON.stringify({ error: e.message }),
		});
	}
};
