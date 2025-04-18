const { callHandler } = require('./callHandler');

function statusCodeIs(result, code) {
	return [`status code is ${code}`, result.statusCode === code];
}

function contentTypeIs(result, contentType) {
	return [`content type is ${contentType}`, result.headers['content-type'] === contentType];
}

function deserializesToJson(result) {
	try {
		return ['deserializes to json', !!JSON.parse(result.body)];
	} catch {
		return ['deserializes to json', false];
	}
}

(async () => {
	let failed = false;

	const tests = [
		{
			name: 'plates json',
			path: '/api/plates',
			headers: { 'accept': 'application/json' },
			asserts: [
				result => statusCodeIs(result, 200),
				result => contentTypeIs(result, 'application/json'),
				result => deserializesToJson(result),
			],
		},
		{
			name: 'plates csv',
			path: '/api/plates',
			headers: { 'accept': 'text/csv' },
			asserts: [
				(result) => statusCodeIs(result, 200),
				(result) => contentTypeIs(result, 'text/csv'),
			],
		}
	]

	const results = [];

	for (const test of tests) {
		const result = await callHandler(test.path, test.query, test.headers);
		// console.log(JSON.stringify(result.body));
		const assertResults = test.asserts.map(a => a(result));
		failed ||= assertResults.some(([condition, assertResult]) => assertResult !== true);
		results.push({ [test.name]: assertResults });
	}

	if (failed) {
		console.log(JSON.stringify(results.filter(e => Object.keys(e).find(k => e[k].some(r => r[1] === false))), null, '  '));
		process.exit(1);
	} else {
		process.exit(0);
	}
})();
