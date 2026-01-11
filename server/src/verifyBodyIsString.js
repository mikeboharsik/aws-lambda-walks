function verifyBodyIsString(result) {
	if (result.body && typeof result.body !== 'string' && !result instanceof Buffer) {
		result.body = JSON.stringify(result.body);
	}
}

module.exports = {
	verifyBodyIsString
};
