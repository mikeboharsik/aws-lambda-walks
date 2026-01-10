const { makeQueryStringParametersSafe } = require('./makeQueryStringParametersSafe.js');

const handlers = Object.values(require('./handlers')).map(c => new c());;

async function handleApiRequest(event) {
	try {
		const { isAuthed, queryStringParameters = null, rawPath } = event;

		event.log(`handle api request for ${rawPath}`, makeQueryStringParametersSafe(queryStringParameters));

		const rawPathWithoutApi = rawPath.replace(/\/api/, '');
		const handler = handlers.find(handler => rawPathWithoutApi.match(handler.path));
		if (!handler) {
			event.log(`failed to find handler for [${rawPathWithoutApi}]`);
			return { statusCode: 404 };
		}

		if (handler.requiresAuth && !isAuthed) {
			return { statusCode: 401 };
		}

		await handler.validateRequest(event);
		
		return await handler.process(event);
	} catch (e) {
		event.logError('Error occurred while handling API request', e);
		return {
			statusCode: 400,
			body: JSON.stringify({ error: e.message }),
		}
	}
}

module.exports = {
	handleApiRequest
};
