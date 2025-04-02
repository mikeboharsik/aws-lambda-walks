const fsPromises = require('fs/promises');

const { setJsonContentType } = require('./setJsonContentType.js');
const { getBenchmarkedFunctionAsync } = require('./getBenchmarkedFunction.js');

async function getGlobalStats() {
	return JSON.parse(await fsPromises.readFile(`./globalStats/globalStats.json`));
}
const getGlobalStatsBenched = getBenchmarkedFunctionAsync(getGlobalStats);

async function handleGlobalStatsRequest() {
	try {
		const parsed = await getGlobalStatsBenched();
		return setJsonContentType({
			statusCode: 200,
			body: JSON.stringify(parsed),
		});
	} catch (e) {
		return setJsonContentType({
			statusCode: 400,
			body: JSON.stringify({ error: e.message }),
		});
	}
}

module.exports = {
	handleGlobalStatsRequest
};
