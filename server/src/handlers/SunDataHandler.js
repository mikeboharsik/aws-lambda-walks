const { ApiRequestHandler } = require('./ApiRequestHandler');

class SunDataHandler extends ApiRequestHandler {
	constructor() {
		super();
		this.path = '/sunx';
		this.requiresAuth = false;
	}

	async process(event) {
		const { queryStringParameters: { date } = {} } = event;

		if (!date) {
			return this.getJsonResponse(400, JSON.stringify({ error: 'date query parameter is required' }));
		}

		if (!date.match(/^\d{4}-\d{2}-\d{2}/)) {
			return this.getJsonResponse(400, JSON.stringify({ error: 'date query parameter must be in format yyyy-MM-dd' }));
		}

		try {
			const response = await fetch(`https://api.sunrise-sunset.org/json?lat=${process.env.SUNX_LATITUDE}&lng=${process.env.SUNX_LONGITUDE}&formatted=0&date=${date}`);
			const responseJson = await response.json();

			if (!response.ok) {
				throw new Error(responseJson.status);
			}

			return this.getJsonResponse(200, JSON.stringify(responseJson));
		} catch(e) {
			return this.getJsonResponse(400, JSON.stringify({ message: e.message }));
		}
	}
};

module.exports = {
	SunDataHandler
};
