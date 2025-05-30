const handler = require('../src/index').handler;
const fixtures = require('./fixtures.json');

const [handlerInput] = fixtures;

async function callHandler(path = null, query = null, headers = null, ignoreAuth = false) {
	if (path) {
		handlerInput.rawPath = path;
	}
	if (query) {
		const processedParameters = query
			.replace('?', '')
			.split('&')
			.reduce((acc, keyval) => {
				const [k, v] = keyval.split('=');
				acc[k] = v;
				return acc;
			}, {});
		handlerInput.rawQueryString = query;
		handlerInput.queryStringParameters = processedParameters;
	}
	if (headers) {
		handlerInput.headers = { ...handlerInput.headers, ...headers };
	}

	return await handler(handlerInput, ignoreAuth);
}

module.exports = {
	callHandler,
};