const { ApiRequestHandler } = require('./ApiRequestHandler');

class YouTubeThumbnailHandler extends ApiRequestHandler {
	constructor() {
		super();
		this.path = /\/yt-thumbnail/;
		this.requiresAuth = false;
	}

	async process(event) {
		const { queryStringParameters: { videoId } = {} } = event;

		if (!videoId) {
			throw new Error("Missing query parameter videoId");
		}

		const res = await fetch(`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`);
		if (res.ok) {
			const buffer = await fetch(`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`).then(res => res.arrayBuffer());

			return this.getJpegResponse(buffer);
		}

		return this.getPlaintextResponse(404);
	}
};

module.exports = {
	YouTubeThumbnailHandler
};
