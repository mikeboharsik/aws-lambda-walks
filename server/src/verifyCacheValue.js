const minuteInSeconds = 60;
const hourInSeconds = minuteInSeconds * 60;
const dayInSeconds = hourInSeconds * 24;
const yearInSeconds = dayInSeconds * 365;

const routeCacheValues = {
	'/api/yt-thumbnail': yearInSeconds,
};

function verifyCacheValue(event, result, rawPath) {
  if (!result.headers) result.headers = {};
  const { headers } = result;
	if (event.authExpires) {
		headers['expires'] = event.authExpires;
	}	else if (!headers['cache-control'] && !headers['expires']) {
		if (routeCacheValues[rawPath]) {
			const cacheValue = routeCacheValues[rawPath];
			headers['cache-control'] = `max-age=${cacheValue}`;
		} else {
			headers['cache-control'] = `max-age=${yearInSeconds}`;
		}
	}
}

module.exports = {
	verifyCacheValue
};