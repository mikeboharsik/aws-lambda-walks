const { ApiRequestHandler } = require('./ApiRequestHandler');

const { getWalksByMonth } = require('../getWalksByMonth.js');

class WalksHandler extends ApiRequestHandler {
	constructor() {
		super();
		this.path = /\/walks/;
		this.requiresAuth = false;
	}

	async process(event) {
		try {
			return await getWalksByMonth(event);
		} catch (e) {
			event.logError(e);
			return {
				statusCode: 400
			};
		}
	}
};

module.exports = {
	WalksHandler,
};