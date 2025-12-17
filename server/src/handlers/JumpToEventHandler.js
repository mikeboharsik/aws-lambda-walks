const { ApiRequestHandler } = require('./ApiRequestHandler');
const getEvent = require('../util/getEvent.js');

class JumpToEventHandler extends ApiRequestHandler {
	constructor() {
		super();
		this.path = /\/jumpToEvent/;
		this.requiresAuth = false;
	}

	async process(requestEvent) {
		const { isAuthed, queryStringParameters: { id = null } = {} } = requestEvent;

		if (!id) {
			return setJsonContentType({
				statusCode: 400,
				body: JSON.stringify({ error: 'query parameter id must be specified' }),
			});
		}

		const event = await getEvent(id);
		if (!event) {
			return this.getJsonResponse(400, JSON.stringify({ error: `Failed to find event with ID [${id}]` }));
		}
		
		let eventStartTime = 0;
		if (event.start) {
			eventStartTime = event.start;
		} else if (event.timestamp) {
			eventStartTime = event.timestamp;
		}
		
		if (!eventStartTime) {
			return this.getJsonResponse(500, JSON.stringify({ error: 'Could not find a start time for the event' }));
		}

		const walkStartTime = event.walkStartTime;
		if (!walkStartTime) {
			return this.getJsonResponse(500, JSON.stringify({ error: 'Could not find a start time for the event\'s walk' }));
		}		

		const eventStartTimeInSeconds = Math.floor((eventStartTime - walkStartTime) / 1000);

		if (isAuthed && event.walkPrivateYoutubeId) {
			return this.getTemporaryRedirectResponse(`https://youtu.be/${event.walkPrivateYoutubeId}?t=${eventStartTimeInSeconds}`);
		} else {
			const trimmedStart = Math.floor(event.walkTrimmedStart / 1000);
			return this.getTemporaryRedirectResponse(`https://youtu.be/${event.walkYoutubeId}?t=${eventStartTimeInSeconds - trimmedStart}`);
		}
	}
};

module.exports = {
	JumpToEventHandler
};
