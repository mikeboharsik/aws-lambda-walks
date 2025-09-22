const { callHandler } = require('../callHandler');

const PATH = '/api/events';

test('returns 401 if not authed', async () => {
	const result = await callHandler(PATH);

	expect(result.body).toBe(undefined);
	expect(result.statusCode).toBe(401);
});

test('returns 200 with JSON if authed', async () => {
	const result = await callHandler(PATH, null, null, true);
	const body = JSON.parse(result.body);

	expect(result.statusCode).toBe(200);
	const expectedKeys = ['id'];
	expectedKeys.forEach(key => body.forEach(event => expect(event).toHaveProperty(key)));
});