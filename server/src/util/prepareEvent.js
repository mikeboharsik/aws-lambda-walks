function prepareEvent(event) {
	const requestId = crypto.randomUUID();
	event.startMs = performance.now();
	event.log = function log(...args) {
		console.log(`[${requestId}]`, ...args);
	};
	event.logError = function logError(...args) {
		console.error(`[${requestId}]`, ...args);
	};
	event.cookies = event.cookies || event.headers?.cookie?.split(';').map(e => e.trim()) || [];
	event.cookiesParsed = event.cookies.map(e => e.split('=')).reduce((acc, [k, v]) => { if (k) { acc[k] = v; } return acc; }, {});
}

module.exports = prepareEvent;
