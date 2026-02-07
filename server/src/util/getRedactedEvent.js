const cookiesToRedact = ['access_token', 'id_token'];

function getRedactedEvent(event) {
	const copy = JSON.parse(JSON.stringify(event));
	if (copy.cookies) {
		copy.cookies?.forEach?.((cookie, idx) => {
			if (cookiesToRedact.some(key => cookie.startsWith(key))) {
				const [k, v] = cookie.split('=');
				if (cookiesToRedact.includes(k)) {
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
	}
	return copy;
}

module.exports = getRedactedEvent;
