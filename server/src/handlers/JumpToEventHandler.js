const { ApiRequestHandler } = require('./ApiRequestHandler');
const getEvent = require('../util/getEvent.js');

class JumpToEventHandler extends ApiRequestHandler {
	constructor() {
		super();
		this.path = /\/jumpToEvent/;
		this.requiresAuth = false;
	}

	async process(event) {
		const { isAuthed, queryStringParameters: { id = null } = {} } = event;

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
		
		const eventStartTime = result.timestamp || result.start || result.trimmedStart;
		const walkStartTime = result.walkStartTime;
		if (!eventStartTime) {
			return this.getJsonResponse(500, JSON.stringify({ error: 'Could not find a start time for the event' }));
		}

		const eventStartTimeInSeconds = Math.floor((eventStartTime - walkStartTime) / 1000);

		if (isAuthed && result.walkPrivateYoutubeId) {
			return this.getTemporaryRedirectResponse(`https://youtu.be/${result.walkPrivateYoutubeId}?t=${eventStartTimeInSeconds}`);
		} else {
			const trimmedOffset = Math.floor(result.walkTrimmedOffset / 1000);
			return this.getTemporaryRedirectResponse(`https://youtu.be/${result.walkYoutubeId}?t=${eventStartTimeInSeconds - trimmedOffset}`);
		}
	}
};

module.exports = {
	JumpToEventHandler
};
