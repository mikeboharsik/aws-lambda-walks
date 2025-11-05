const fsPromises = require('fs/promises');

const { ApiRequestHandler } = require('./ApiRequestHandler');

const { getBenchmarkedFunctionAsync } = require('../util/getBenchmarkedFunction.js');

async function getGlobalStats() {
	return JSON.parse(await fsPromises.readFile(`${process.env.GENERATED_PATH || '.'}/globalStats/globalStats.json`));
}
const getGlobalStatsBenched = getBenchmarkedFunctionAsync(getGlobalStats);

class GlobalStatsHandler extends ApiRequestHandler {
	constructor() {
		super();
		this.path = /\/globalStats/;
		this.requiresAuth = false;
	}

	async process(event) {
		try {
			const parsed = await getGlobalStatsBenched();
			return this.getJsonResponse(200, JSON.stringify(parsed));
		} catch (e) {
			return this.getJsonResponse(400, JSON.stringify({ error: e.message }));
		}
	}
};

module.exports = {
	GlobalStatsHandler
};
