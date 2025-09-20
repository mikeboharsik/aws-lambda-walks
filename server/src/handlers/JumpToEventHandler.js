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
		
		let totalSeconds;
		if (result.start) {
			totalSeconds = Math.floor(result.start / 1000);
		} else if (result.trimmedStart) {
			totalSeconds = Math.floor(result.trimmedStart / 1000);
		} else {
			return this.getJsonResponse(500, JSON.stringify({ error: 'Could not find a start time for the event' }));
		}

		const redirectUrl = `https://youtu.be/${result.youtubeId}?t=${totalSeconds}`;

		return this.getTemporaryRedirectResponse(redirectUrl);
	}
};

module.exports = {
	JumpToEventHandler
};
