const fsPromises = require('fs/promises');

const { ApiRequestHandler } = require('./ApiRequestHandler');

class GitHandler extends ApiRequestHandler {
	constructor() {
		super();
		this.path = /\/git/;
		this.requiresAuth = false;
	}

	async process(event) {
		const content = await fsPromises.readFile('./git.json', 'utf8');
		return this.getJsonResponse(200, content);
	}
};

module.exports = {
	GitHandler
};
