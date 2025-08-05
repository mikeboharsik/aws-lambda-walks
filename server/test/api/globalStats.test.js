const { callHandler } = require('../callHandler');

const PATH = '/api/globalStats';

test('returns 200 with JSON', async () => {
	const result = await callHandler(PATH);
	const body = JSON.parse(result.body);

	expect(result.statusCode).toBe(200);

	const expectedKeys = ['earliestWalk', 'longestWalk', 'meanEventCount', 'medianEventCount', 'meanWalkDistance', 'medianWalkDistance', 'totalDistance', 'totalPlateDetections', 'totalRecordedWalks', 'totalWalks', 'towns', 'walkWithMostEvents', 'walkWithMostPlates', 'walkWithMostNewPlates'];
	expectedKeys.forEach(key => expect(body).toHaveProperty(key));
});