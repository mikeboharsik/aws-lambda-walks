const { callHandler } = require('../callHandler');

const PATH = '/api/plates';

test('returns 401 if not authed', async () => {
	const result = await callHandler(PATH);

	expect(result.statusCode).toBe(401);
});

test('returns 200 with JSON if requested with auth', async () => {
	const result = await callHandler(PATH, null, { accept: 'application/json' }, true);

	expect(result.statusCode).toBe(200);
	expect(() => JSON.parse(result.body)).not.toThrow();
});

test('returns 200 with CSV if requested with auth', async () => {
	const result = await callHandler(PATH, null, { accept: 'text/csv' }, true);

	expect(result.statusCode).toBe(200);
	expect(() => JSON.parse(result.body)).toThrow();
});