const { callHandler } = require('./callHandler');

function statusCodeIs(result, code) {
	return [`status code is ${code}`, result.statusCode === code, `got ${result.statusCode}`];
}

function contentTypeIs(result, contentType) {
	return [`content type is ${contentType}`, result.headers['content-type'] === contentType || result.headers['Content-Type'] === contentType, `got ${result.headers['content-type'] || result.headers['Content-Type']}`];
}

function deserializesToJson(result) {
	try {
		return ['deserializes to json', !!JSON.parse(result.body)];
	} catch {
		return ['deserializes to json', false];
	}
}

function isStringArray(result) {
	try {
		const arr = JSON.parse(result.body);
		return ['is string array', arr instanceof Array && arr.every(e => typeof e === 'string')];
	} catch {
		return ['is string array', false];
	}
}

(async () => {
	let failed = false;

	const tests = [
		{
			name: 'yt-thumbnail fails without a videoId',
			path: '/api/yt-thumbnail',
			ignoreAuth: false,
			asserts: [
				result => statusCodeIs(result, 400),
			],
		},
		{
			name: 'yt-thumbnail fails with a non-existent videoId',
			path: '/api/yt-thumbnail',
			query: '?videoId=does not and will never exist',
			ignoreAuth: false,
			asserts: [
				result => statusCodeIs(result, 404),
			],
		},
		{
			name: 'yt-thumbnail succeeds when given a videoId',
			path: '/api/yt-thumbnail',
			query: '?videoId=AmuQjMbLwx0',
			ignoreAuth: false,
			asserts: [
				result => statusCodeIs(result, 200),
			],
		},
		{
			name: 'globalStats succeeds',
			path: '/api/globalStats',
			ignoreAuth: false,
			asserts: [
				result => statusCodeIs(result, 200),
				result => deserializesToJson(result),
			],
		},
		{
			name: 'youtubeIds succeeds',
			path: '/api/youtubeIds',
			ignoreAuth: false,
			asserts: [
				result => statusCodeIs(result, 200),
				result => deserializesToJson(result),
				result => isStringArray(result),
			],
		},
		{
			name: 'routes with no params fails',
			path: '/api/routes',
			ignoreAuth: false,
			asserts: [
				result => statusCodeIs(result, 400),
			],
		},
		{
			name: 'routes with date succeeds',
			path: '/api/routes',
			query: '?date=2025-05-29',
			ignoreAuth: false,
			asserts: [
				result => statusCodeIs(result, 200),
			],
		},
		{
			name: 'plates fails if not authed',
			path: '/api/plates',
			ignoreAuth: false,
			asserts: [
				result => statusCodeIs(result, 401),
			],
		},
		{
			name: 'plates json',
			path: '/api/plates',
			headers: { 'accept': 'application/json' },
			ignoreAuth: true,
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
			ignoreAuth: true,
			asserts: [
				(result) => statusCodeIs(result, 200),
				(result) => contentTypeIs(result, 'text/csv'),
			],
		}
	]

	const results = [];

	for (const test of tests) {
		if (test.skip) {
			continue;
		}
		
		const result = await callHandler(test.path, test.query, test.headers, test.ignoreAuth);

		const assertResults = test.asserts.map(a => a(result));
		const someFailed = assertResults.some(([condition, assertResult]) => assertResult !== true);
		failed ||= someFailed;

		if (someFailed) {
			
			try {
				process.stderr.write('Error response from API: ' + (result?.body ?? JSON.parse(result?.body || 'null')?.error) + '\n');
			} catch (e) {
				// process.stderr.write(e.message + '\n');
			}
		}

		results.push({ [test.name]: assertResults });
	}

	if (failed) {
		process.stderr.write(JSON.stringify(results.filter(e => Object.keys(e).find(k => e[k].some(r => r[1] === false))), null, '  '));
		process.exit(1);
	} else {
		process.exit(0);
	}
})();
