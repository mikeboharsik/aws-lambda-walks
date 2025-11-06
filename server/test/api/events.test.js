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
	expect(body instanceof Array).toBe(true);	

	const expectedKeys = ['id'];
	expectedKeys.forEach(key => {
		body.forEach(event => {
			expect(event instanceof Object).toBe(true);
			expect(event).toHaveProperty(key)
		});
	});
});

test('returns single event when id is provided', async () => {
	const result = await callHandler(PATH, '?id=a1aa0abd-c857-4603-86e6-1d620e74d843', null, true);
	const body = JSON.parse(result.body);

	expect(result.statusCode).toBe(200);
	expect(body instanceof Object).toBe(true);

	const expectedKeys = ['id'];
	expectedKeys.forEach(key => {
		expect(body).toHaveProperty(key)
	});
});