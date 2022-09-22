const handler = require('./index').handler;
const tests = require('./tests.json');

const [test] = tests;
const [ , , rawPathOverride] = process.argv;
if (rawPathOverride) {
	test.rawPath = rawPathOverride;
}

(async () => {
	console.log('Handler result:', await handler(test));
})();
