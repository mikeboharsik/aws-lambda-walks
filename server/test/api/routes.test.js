const { callHandler } = require('../callHandler');

const PATH = '/api/routes';

test('returns 400 if no params are provided', async () => {
	const result = await callHandler(PATH);
	const body = JSON.parse(result.body);

	expect(result.statusCode).toBe(400);
	expect(body.error).toBe('query parameter date or nearPoint must be provided');
});

test('returns 400 if route does not exist', async () => {
	const result = await callHandler(PATH, '?date=2000-01-01');
	const body = JSON.parse(result.body);

	expect(result.statusCode).toBe(400);
	expect(body.error).toBe('Failed to load data for month 2000-01');
});

test('returns 200 if route does exist', async () => {
	const result = await callHandler(PATH, '?date=2025-08-05');
	expect(result.statusCode).toBe(200);
	expect(result.headers['Content-Type']).toBe('text/html');
});
