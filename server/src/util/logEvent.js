function logEvent(event) {
	const copy = JSON.parse(JSON.stringify(event));
	if (copy.cookies) {
		copy.cookies?.forEach?.((cookie, idx) => {
			if (cookie.startsWith('access_token')) {
				const [k, v] = cookie.split('=');
				if (k === 'access_token') {
					const newCookie = k + '=' + v.slice(0, 10) + '...' + v.slice(-10);
					copy.cookies.splice(idx, 1, newCookie);
				}
			}
		});
		delete copy.cookiesParsed;
		delete copy.headers?.cookie;
		delete copy.headers?.cookies;
		delete copy.headers?.Cookie;
		delete copy.headers?.Cookies;
		delete copy.startMs;
	}
	event.log(JSON.stringify(copy));
}

module.exports = logEvent;
