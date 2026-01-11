const { callHandler } = require('../callHandler');

const PATH = '/api/yt-thumbnail';

test('returns 400 without a videoId', async () => {
	const result = await callHandler(PATH, null, null, false);
	const body = JSON.parse(result.body);

	expect(result.statusCode).toBe(400);
	expect(body.error).toBe('Missing query parameter videoId');
});

test('returns 404 for a non-existent videoId', async () => {
	const result = await callHandler(PATH, '?videoId=does not and will never exist', null, false);
	expect(result.statusCode).toBe(404);
});

test('returns 200 for an existent videoId', async () => {
	const result = await callHandler(PATH, '?videoId=AmuQjMbLwx0', null, false);

	expect(result.statusCode).toBe(200);
});
