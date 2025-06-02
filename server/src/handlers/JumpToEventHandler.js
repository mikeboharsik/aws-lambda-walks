const fsPromises = require('fs/promises');

const { ApiRequestHandler } = require('./ApiRequestHandler');

const { getBenchmarkedFunctionAsync } = require('../getBenchmarkedFunction.js');

async function getAllEvents(event) {
	const content = await fsPromises.readFile(`${process.env.GENERATED_PATH || '.'}/events/all.json`);
	return JSON.parse(content);
}
const getAllEventsBenched = getBenchmarkedFunctionAsync(getAllEvents);

class JumpToEventHandler extends ApiRequestHandler {
	constructor() {
		super();
		this.path = /\/jumpToEvent/;
		this.requiresAuth = false;
	}

	async process(event) {
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
			return this.getJsonResponse(400, JSON.stringify({ error: `Failed to find event with ID [${id}]` }));
		}
		
		const [, hours, minutes, seconds] = result.trimmedStart.match(/(\d{2}):(\d{2}):(\d{2})/);
		const totalSeconds = (parseInt(hours) * 60 * 60) + (parseInt(minutes) * 60) + parseInt(seconds);
		const redirectUrl = `https://youtu.be/${result.youtubeId}?t=${totalSeconds}`;

		return this.getTemporaryRedirectResponse(redirectUrl);
	}
};

module.exports = {
	JumpToEventHandler
};
