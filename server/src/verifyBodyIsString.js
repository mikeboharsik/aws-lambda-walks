function verifyBodyIsString(result) {
	const isBuffer = Buffer.isBuffer(result.body);
	const isString = typeof result.body === 'string';
	if (result.body && !isString && !isBuffer) {
		result.body = JSON.stringify(result.body);
	}
}

module.exports = {
	verifyBodyIsString
};
