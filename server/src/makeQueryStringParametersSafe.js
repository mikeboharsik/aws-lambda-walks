function makeQueryStringParametersSafe(qsp) {
	if (!qsp) return null;

	const copy = JSON.parse(JSON.stringify(qsp));

	if (copy.jwt) {
		copy.jwt = '*****';
	}

	return copy;
}

module.exports = {
	makeQueryStringParametersSafe
}