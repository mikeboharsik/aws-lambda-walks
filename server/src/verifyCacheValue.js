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
		const nowInSeconds = Math.floor(new Date().getTime() / 1000);
		const maxAge = Math.max(0, event.authExpires - nowInSeconds);
		console.log(JSON.stringify({ authExpires: event.authExpires, nowInSeconds, maxAge }));
		headers['expires'] = event.authExpires;
	}	else if (!headers['cache-control'] && !headers['expires']) {
		if (routeCacheValues[rawPath]) {
			const cacheValue = routeCacheValues[rawPath];
			headers['cache-control'] = `max-age=${cacheValue}`;
		} else {
			headers['cache-control'] = `max-age=${yearInSeconds}`;
		}
	}
	console.log(`Set cache-control header to [${headers['cache-control']}], expires to [${headers.expires}]`);
}

module.exports = {
	verifyCacheValue
};