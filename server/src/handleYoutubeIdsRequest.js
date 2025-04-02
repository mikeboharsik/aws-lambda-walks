const fsPromises = require('fs/promises');

const { getBenchmarkedFunctionAsync } = require('./getBenchmarkedFunction.js');

async function getAllYoutubeIds() {
	return JSON.parse(await fsPromises.readFile(`./youtubeIds/youtubeIds.json`));
}
const getAllYoutubeIdsBenched = getBenchmarkedFunctionAsync(getAllYoutubeIds);

async function handleYoutubeIdsRequest(event) {
	try {
		const parsed = await getAllYoutubeIdsBenched();
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
	handleYoutubeIdsRequest
}