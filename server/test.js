const handler = require('./index').handler;
const tests = require('./tests.json');

const [test] = tests;
const [ , , rawPathOverride, queryStringParametersOverride] = process.argv;
if (rawPathOverride) {
	test.rawPath = rawPathOverride;
	console.log(`rawPath overridden with [${rawPathOverride}]`);
}

if (queryStringParametersOverride) {
	const processedParameters = queryStringParametersOverride
		.split('&')
		.reduce((acc, keyval) => {
			const [key, val] = keyval.split('=');
			acc[key] = val;
			return acc;
		}, {});

	test.queryStringParameters = processedParameters;
	
	console.log(`queryStringParameters overridden with [${JSON.stringify(processedParameters)}]`);
}

(async () => {
	console.log('Handler result:', await handler(test));
})();
