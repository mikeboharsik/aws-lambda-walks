const { ApiRequestHandler } = require('./ApiRequestHandler');
const getEvent = require('../util/getEvent.js');

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

		const result = await getEvent(id);
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

		const redirectUrl = `https://youtu.be/${result.walkYoutubeId}?t=${totalSeconds}`;

		return this.getTemporaryRedirectResponse(redirectUrl);
	}
};

module.exports = {
	JumpToEventHandler
};
