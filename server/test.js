const handler = require('./index').handler;
const tests = require('./tests.json');

const [test] = tests;

process.argv.forEach((key, idx, arr) => {
	const val = arr[idx+1];

	switch (key.toLowerCase()) {
		case '-path': {
			test.rawPath = val;
			break;
		}

		case '-query': {
			const processedParameters = val
				.replace('?', '')
				.split('&')
				.reduce((acc, keyval) => {
					const [k, v] = keyval.split('=');
					acc[k] = v;
					return acc;
				}, {});

			test.rawQueryString = val;
			test.queryStringParameters = processedParameters;
			break;
		}

		case '-x-custom-key': {
			test.headers['x-custom-key'] = val;
			break;
		}
	}
});

(async () => {
	console.log('Handler result:', await handler(test));
})();
