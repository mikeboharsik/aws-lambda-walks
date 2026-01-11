class ApiRequestHandler {
	constructor() {
		this.path = null;
		this.requiresAuth = true;
	}

	getResponse(statusCode, body = undefined) {
		return { statusCode, body };
	}

	getGeoJsonResponse(statusCode, body) {
		return {
			...this.getJsonResponse(statusCode, body),
			headers: { 'Content-Type': 'application/geo+json' },
		};
	}

	getJsonResponse(statusCode, body = undefined) {
		return {
			...this.getResponse(statusCode, typeof body === 'string' ? body : JSON.stringify(body)),
			headers: { 'Content-Type': 'application/json' },
		};
	}

	getJsonResponseWithYearExpiration(statusCode, body = undefined) {
		return {
			...this.getResponse(statusCode, typeof body === 'string' ? body : JSON.stringify(body)),
			headers: { 'Content-Type': 'application/json', 'cache-control': 'max-age=31556926' },
		};
	}

	getCsvResponse(statusCode, body = undefined) {
		return {
			...this.getResponse(statusCode, body),
			headers: { 'Content-Type': 'text/csv' },
		};
	}

	getHtmlResponse(statusCode, body = undefined) {
		return {
			...this.getResponse(statusCode, body),
			headers: { 'Content-Type': 'text/html' },
		};
	}

	getPlaintextResponse(statusCode, body = undefined) {
		return {
			...this.getResponse(statusCode, body),
			headers: { 'Content-Type': 'text/plain' },
		};
	}

	getJpegResponseWithYearExpiration(buffer) {
		return {
			body: Buffer.from(buffer),
			headers: { 'content-type': 'image/jpeg', 'cache-control': 'max-age=31556926' },
			statusCode: 200
		};
	}

	getTemporaryRedirectResponse(location) {
		return {
			headers: {
				Location: location,
			},
			statusCode: 302
		};
	}

	async validateRequest(event) {}
	async process(event) {}
};

module.exports = {
	ApiRequestHandler,
};