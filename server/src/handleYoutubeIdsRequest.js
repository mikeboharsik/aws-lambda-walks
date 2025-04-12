const fsPromises = require('fs/promises');

const { setJsonContentType } = require('./setJsonContentType.js');
const { getBenchmarkedFunctionAsync } = require('./getBenchmarkedFunction.js');

async function getAllYoutubeIds() {
	return JSON.parse(await fsPromises.readFile(`${process.env.GENERATED_PATH || '.'}/youtubeIds/youtubeIds.json`));
}
const getAllYoutubeIdsBenched = getBenchmarkedFunctionAsync(getAllYoutubeIds);

async function handleYoutubeIdsRequest(event) {
	try {
		const parsed = await getAllYoutubeIdsBenched();
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
	handleYoutubeIdsRequest
}