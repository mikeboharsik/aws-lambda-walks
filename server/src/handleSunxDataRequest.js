const fetch = require('node-fetch');

const { setJsonContentType } = require('./setJsonContentType.js');

async function handleSunxDataRequest(event) {
	const { queryStringParameters: { date } = {} } = event;

	if (!date) {
		return setJsonContentType({
			body: JSON.stringify({ error: 'date query parameter is required' }),
			statusCode: 400,
			headers: { 'content-type': 'application/json' },
		});
	}

	if (!date.match(/^\d{4}-\d{2}-\d{2}/)) {
		return setJsonContentType({
			body: JSON.stringify({ error: 'date query parameter must be in format yyyy-MM-dd' }),
			statusCode: 400,
			headers: { 'content-type': 'application/json' },
		});
	}

	try {
		const response = await fetch(`https://api.sunrise-sunset.org/json?lat=${process.env.SUNX_LATITUDE}&lng=${process.env.SUNX_LONGITUDE}&formatted=0&date=${date}`);
		const responseJson = await response.json();

		if (!response.ok) {
			throw new Error(responseJson.status);
		}

		return setJsonContentType({
			body: JSON.stringify(responseJson),
			statusCode: 200,
			headers: { 'content-type': 'application/json' },
		});
	} catch(e) {
		return setJsonContentType({
			body: JSON.stringify({ message: e.message }),
			statusCode: 400,
			headers: { 'content-type': 'application/json' },
		});
	}
}

module.exports = {
	handleSunxDataRequest
}
