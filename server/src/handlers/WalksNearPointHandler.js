const { ApiRequestHandler } = require('./ApiRequestHandler.js');

class WalksNearPointHandler extends ApiRequestHandler {
	constructor() {
		super();
		this.path = /^\/walksNearPoint$/;
		this.requiresAuth = false;
	}

	async process(event) {
		try {
			const { queryStringParameters = null } = event;
			let radius = null, targetPoint = null;
			if (queryStringParameters) {
				({ radius, targetPoint } = queryStringParameters);
			}

			if (radius === null || radius === undefined || targetPoint === null || targetPoint === undefined) {
				return this.getJsonResponse(400, JSON.stringify({ error: 'targetPoint and radius must be provided' }));
			}

			return this.getJsonResponse(200, '');
		} catch (e) {
			return this.getJsonResponse(400, JSON.stringify({ error: e.message }));
		}
	}
}

module.exports = {
	WalksNearPointHandler
};