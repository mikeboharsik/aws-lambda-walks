const fsPromises = require('fs/promises');

const { setJsonContentType } = require('./setJsonContentType.js');
const { getBenchmarkedFunctionAsync } = require('./getBenchmarkedFunction.js');

async function getAllEvents(event) {
	const content = await fsPromises.readFile(`${process.env.GENERATED_PATH || '.'}/events/all.json`);
	return JSON.parse(content);
}
const getAllEventsBenched = getBenchmarkedFunctionAsync(getAllEvents);

async function handleJumpToEvent(event) {
	const { queryStringParameters: { id = null } = {} } = event;

	if (!id) {
		return setJsonContentType({
			statusCode: 400,
			body: JSON.stringify({ error: 'query parameter id must be specified' }),
		});
	}

	const allEvents = await getAllEventsBenched();
	const result = allEvents.find(ev => ev.id === id);

	if (!result) {
		return setJsonContentType({
			statusCode: 400,
			body: JSON.stringify({ error: `Failed to find event with ID [${id}]` }),
		});
	}
	
	const [, hours, minutes, seconds] = result.trimmedStart.match(/(\d{2}):(\d{2}):(\d{2})/);
	const totalSeconds = (parseInt(hours) * 60 * 60) + (parseInt(minutes) * 60) + parseInt(seconds);
	const redirectUrl = `https://youtu.be/${result.youtubeId}?t=${totalSeconds}`;

	return {
		statusCode: 302,
		headers: {
			Location: redirectUrl,
		},
	};
}

module.exports = {
	handleJumpToEvent
};
