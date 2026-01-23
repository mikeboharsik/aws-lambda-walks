const path = require('path');

require('./setupLoggers.js');
require('dotenv').config({ path: [path.resolve(`${__dirname}/../.env`)], quiet: true });

const { authenticate } = require('./auth.js');
const { handleApiRequest } = require('./handleApiRequest.js');
const { handleAuthResponseRequest } = require('./handleAuthResponseRequest.js');
const { handleContentRequest } = require('./handleContentRequest.js');
const { verifyCacheValue } = require('./verifyCacheValue.js');
const { setJsonContentType } = require('./setJsonContentType.js');
const { verifyBodyIsString } = require('./verifyBodyIsString.js');

const getPrevalidationResult = require('./getPrevalidationResult.js');
const logResult = require('./util/logResult.js');
const logEvent = require('./util/logEvent.js');
const prepareEvent = require('./util/prepareEvent.js');

exports.handler = async (event, ignoreAuth = false) => {
	prepareEvent(event);

	try {
		logEvent(event);

		const prevalidationResult = getPrevalidationResult(event);
		if (prevalidationResult) {
			return prevalidationResult;
		}

		const { rawPath } = event;
		if (Boolean(process.env['LOG_RAW_PATH'])) {
			event.log(rawPath);
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
		} else if (event.cookiesParsed.access_token) {
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
		if (process.env.ENABLE_CACHING === 'true') {
			verifyCacheValue(event, result, rawPath);
		}
		logResult(result, event);

		return result;
	} catch (e) {
		event.logError('Unhandled exception:', e);

		event.log('Returning status code', 500);
		return setJsonContentType({
			statusCode: 500,
			body: JSON.stringify({ error: e.message }),
		});
	}
};
