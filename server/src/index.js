require('./setupLoggers.js');

const { authenticate } = require('./auth.js');
const { handleApiRequest } = require('./handleApiRequest.js');
const { handleContentRequest } = require('./handleContentRequest.js');
const { verifyCacheValue } = require('./verifyCacheValue.js');
const { setJsonContentType } = require('./setJsonContentType.js');
const { verifyBodyIsString } = require('./verifyBodyIsString.js');

function logResult(result) {
	if (Boolean(process.env['LOG_RESULT'])) {
		conditionalLog(ogLog, 'Returning result', JSON.stringify(result, null, '  '));
	}
}

exports.handler = async (event, ignoreAuth = false) => {
	try {
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
		} else if (event?.headers?.authorization || event?.queryStringParameters?.jwt) {
			await authenticate(event);
		}

		const isApiRequest = rawPath.startsWith('/api');
		const handlerFunction = isApiRequest ? handleApiRequest : handleContentRequest;

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
		});
	}
};
