const fsPromises = require('fs/promises');

const { ApiRequestHandler } = require('./ApiRequestHandler');

const getPublicPath = require('../util/getPublicPath.js');

class GitHandler extends ApiRequestHandler {
	constructor() {
		super();
		this.path = /^\/git$/;
		this.requiresAuth = false;
	}

	async process(event) {
		const content = await fsPromises.readFile(getPublicPath() + '/git.json', 'utf8');
		return this.getJsonResponse(200, content);
	}
};

module.exports = {
	GitHandler
};
