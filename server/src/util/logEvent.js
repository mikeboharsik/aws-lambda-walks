const getRedactedEvent = require('./getRedactedEvent');

function logEvent(event) {
	const copy = getRedactedEvent(event);
	delete copy.startMs;
	event.log(JSON.stringify(copy));
}

module.exports = logEvent;
