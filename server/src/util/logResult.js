function logResult(result, event) {
	const totalMs = (performance.now() - event.startMs).toFixed(3);
	delete event.startMs;
	if (process.env.LOG_RESULT === 'true') {
		event.log(`Returning result after ${totalMs}`, JSON.stringify(result, null, '  '));
	} else {
		event.log('Returning status code', result.statusCode, `after ${totalMs} milliseconds`);
	}
}

module.exports = logResult;
