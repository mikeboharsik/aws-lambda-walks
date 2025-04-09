const { makeQueryStringParametersSafe } = require('./makeQueryStringParametersSafe.js');

const { handleCacheInvalidate } = require('./handleCacheInvalidate.js');
const { handleSunxDataRequest } = require('./handleSunxDataRequest.js');
const { handleYouTubeThumbnailRequest } = require('./handleYouTubeThumbnailRequest.js');
const { handleYoutubeIdsRequest } = require('./handleYoutubeIdsRequest.js');
const { handleJumpToEvent } = require('./handleJumpToEvent.js');
const { handleWalkRouteRequest } = require('./handleWalkRouteRequest.js');
const { handlePlatesRequest } = require('./handlePlatesRequest.js');
const { handlePlatesCoordsRequest } = require('./handlePlatesCoordsRequest.js');
const { handleGitRequest } = require('./handleGitRequest.js');
const { handleEventsRequest } = require('./handleEventsRequest.js');
const { handleEventsProximityRequest } = require('./handleEventsProximityRequest.js');
const { handleGlobalStatsRequest } = require('./handleGlobalStatsRequest.js');

async function handleApiRequest(event) {
	const { queryStringParameters = null, rawPath } = event;

	console.log(`handle api request for ${rawPath}`, makeQueryStringParametersSafe(queryStringParameters));

	const routeMap = {
		'/api/sunx': handleSunxDataRequest,
		'/api/yt-thumbnail': handleYouTubeThumbnailRequest,
		'/api/routes': handleWalkRouteRequest,
		'/api/events': handleEventsRequest,
		'/api/plates': handlePlatesRequest,
		'/api/plates/coords': handlePlatesCoordsRequest,
		'/api/plates/proximity': handleEventsProximityRequest,
		'/api/youtubeIds': handleYoutubeIdsRequest,
		'/api/globalStats': handleGlobalStatsRequest,
		'/api/invalidateCache': handleCacheInvalidate,
		'/api/jumpToEvent': handleJumpToEvent,
		'/api/git': handleGitRequest,
		'/api/authtest': async (event) => {
			return {
				statusCode: 200,
				body: JSON.stringify(event),
				headers: { 'content-type': 'application/json' },
			};
		},
	};

	const func = routeMap[rawPath] ?? async function() { return { statusCode: 404 }; };

	return await func(event);
}

module.exports = {
	handleApiRequest
};
