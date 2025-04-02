const fsPromises = require('fs/promises');

const { getBenchmarkedFunctionAsync } = require('./getBenchmarkedFunction.js');

async function getGlobalStats() {
	return JSON.parse(await fsPromises.readFile(`./globalStats/globalStats.json`));
}
const getGlobalStatsBenched = getBenchmarkedFunctionAsync(getGlobalStats);

async function handleGlobalStatsRequest() {
	try {
		const parsed = await getGlobalStatsBenched();
		return {
			statusCode: 200,
			body: JSON.stringify(parsed),
			headers: { 'content-type': 'application/json' }
		};
	} catch (e) {
		return {
			statusCode: 400,
			body: JSON.stringify({ error: e.message }),
			headers: { 'content-type': 'application/json' },
		}
	}
}

module.exports = {
	handleGlobalStatsRequest
};
