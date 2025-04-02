const fsPromises = require('fs/promises');

const { setJsonContentType } = require('./setJsonContentType.js');
const { getBenchmarkedFunctionAsync } = require('./getBenchmarkedFunction.js');

async function getEventsByMonth(event) {
	const { headers: { accept }, queryStringParameters: { q: month } = {} } = event;
	const ext = accept.toLowerCase() === 'text/csv' ? '.csv' : '.json';
	const content = await fsPromises.readFile(`./walks/${month}${ext}`);
	return accept.toLowerCase() === 'text/csv' ? content.toString() : JSON.parse(content);
}
const getEventsByMonthBenched = getBenchmarkedFunctionAsync(getEventsByMonth);

async function handleEventsRequest(event) {
	const { isAuthed, headers: { accept }, queryStringParameters: { q = null } = {} } = event;
	if (!q?.match(/\d{4}-\d{2}/)) {
		return setJsonContentType({
			statusCode: 400,
			body: JSON.stringify({ error: "q must be provided and in yyyy-MM format" }),
		});
	}
	const acceptHeader = accept.toLowerCase();

	try {
		const parsed = await getEventsByMonthBenched(event);
		const contentHeader = { 'content-type': acceptHeader === 'text/csv' ? 'text/csv' : 'application/json' };
		return {
			statusCode: 200,
			body: acceptHeader === 'text/csv' ? parsed : JSON.stringify(parsed),
			headers: contentHeader,
		};
	} catch (e) {
		console.error(e);
		return {
			statusCode: 404
		};
	}
}

module.exports = {
	handleEventsRequest
};
