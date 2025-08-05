const { callHandler } = require('../callHandler');

const PATH = '/api/youtubeIds';

test('returns 200 with JSON', async () => {
	const result = await callHandler(PATH);
	const body = JSON.parse(result.body);

	expect(result.statusCode).toBe(200);
	expect(Array.isArray(body)).toBe(true);
	body.forEach(el => expect(typeof el).toBe('string'));
});