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
			...this.getResponse(statusCode, body),
			headers: { 'Content-Type': 'application/geo+json' },
		};
	}

	getJsonResponse(statusCode, body = undefined) {
		return {
			...this.getResponse(statusCode, body),
			headers: { 'Content-Type': 'application/json' },
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

	getJpegResponse(arrayBuffer) {
		return {
			body: Buffer.from(arrayBuffer).toString('base64'),
			headers: { 'content-type': 'image/jpg' },
			isBase64Encoded: true,
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