const fsPromises = require('fs/promises');

const { setJsonContentType } = require('./setJsonContentType.js');
const { getBenchmarkedFunctionAsync } = require('./getBenchmarkedFunction.js');

async function getEventsByMonth(event) {
	const { headers: { accept }, queryStringParameters: { q: month } = {} } = event;
	const acceptHeader = accept?.toLowerCase() || 'text/csv';
	const didRequestCsv = acceptHeader === 'text/csv';

	if (!month?.match(/\d{4}-\d{2}/)) {
		return setJsonContentType({
			statusCode: 400,
			body: JSON.stringify({ error: 'q must be provided and in yyyy-MM format' }),
		});
	}

	const ext = didRequestCsv ? '.csv' : '.json';
	let content = await fsPromises.readFile(`${process.env.GENERATED_PATH || '.'}/walks/${month}${ext}`);
	content = didRequestCsv ? content.toString() : JSON.parse(content);
	const contentHeader = { 'content-type': didRequestCsv ? 'text/csv' : 'application/json' };
	return {
		statusCode: 200,
		body: didRequestCsv ? content : JSON.stringify(content),
		headers: contentHeader,
	}
}
const getEventsByMonthBenched = getBenchmarkedFunctionAsync(getEventsByMonth);

async function handleEventsRequest(event) {
	const {
		queryStringParameters: {
			q = null,
		} = {}
	} = event;

	try {
		if (q) {
			return await getEventsByMonthBenched(event);
		}
	} catch (e) {
		console.error(e);
		return {
			statusCode: 400
		};
	}
}

module.exports = {
	handleEventsRequest
};
