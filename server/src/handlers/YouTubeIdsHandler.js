const fsPromises = require('fs/promises');

const { ApiRequestHandler } = require('./ApiRequestHandler');

const { getBenchmarkedFunctionAsync } = require('../getBenchmarkedFunction.js');

async function getAllYoutubeIds() {
	return JSON.parse(await fsPromises.readFile(`${process.env.GENERATED_PATH || '.'}/youtubeIds/youtubeIds.json`));
}
const getAllYoutubeIdsBenched = getBenchmarkedFunctionAsync(getAllYoutubeIds);

class YouTubeIdsHandler extends ApiRequestHandler {
	constructor() {
		super();
		this.path = /\/youtubeIds/;
		this.requiresAuth = false;
	}

	async process(event) {
		try {
			const { queryStringParameters = null } = event;
			let radius, targetPoint;
			if (queryStringParameters) {
				({ radius, targetPoint } = queryStringParameters);
			}

			const parsed = await getAllYoutubeIdsBenched();
			return this.getJsonResponse(200, JSON.stringify(parsed));
		} catch (e) {
			return this.getJsonResponse(400, JSON.stringify({ error: e.message }));
		}
	}
};

module.exports = {
	YouTubeIdsHandler
};
