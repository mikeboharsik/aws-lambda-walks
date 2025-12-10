const geolib = require('geolib');

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

test('returns only events after after when it\'s a timestamp', async () => {
	const cutoff = new Date('2025-01-01').getTime();
	const result = await callHandler(PATH, `?after=${cutoff}`, null, true);
	const body = JSON.parse(result.body);

	expect(result.statusCode).toBe(200);
	expect(body instanceof Array).toBe(true);

	body.forEach(ev => {
		ev.mark && expect(ev.mark >= cutoff);
		!ev.mark && ev.coords && expect(ev.coords[2]).toBeGreaterThanOrEqual(cutoff);
	});
});

test('returns only events after after when it\'s an ISO datetime', async () => {
	const cutoff = '2025-01-01T00:00:00Z';
	const result = await callHandler(PATH, `?after=${cutoff}`, null, true);
	const body = JSON.parse(result.body);

	expect(result.statusCode).toBe(200);
	expect(body instanceof Array).toBe(true);

	body.forEach(ev => {
		ev.mark && expect(ev.mark >= cutoff);
		!ev.mark && ev.coords && expect(ev.coords[2]).toBeGreaterThanOrEqual(new Date(cutoff).getTime());
	});
});

test('returns error if after is not a valid timestamp', async () => {
	const result = await callHandler(PATH, `?after=whocares`, null, true);
	const body = JSON.parse(result.body);

	expect(result.statusCode).toBe(400);
	expect(body instanceof Object).toBe(true);
	expect(body.error).toBe('after must be a valid timestamp or ISO datetime');
});

test('returns only events before before when it\'s a timestamp', async () => {
	const cutoff = new Date('2024-01-01').getTime();
	const result = await callHandler(PATH, `?before=${cutoff}`, null, true);
	const body = JSON.parse(result.body);

	expect(result.statusCode).toBe(200);
	expect(body instanceof Array).toBe(true);

	body.forEach(ev => {
		ev.mark && expect(ev.mark >= cutoff);
		!ev.mark && ev.coords && expect(ev.coords[2]).toBeLessThanOrEqual(cutoff);
	});
});

test('returns only events before before when it\'s an ISO datetime', async () => {
	const cutoff = '2025-06-01T00:00:00Z';
	const result = await callHandler(PATH, `?before=${cutoff}`, null, true);
	const body = JSON.parse(result.body);

	expect(result.statusCode).toBe(200);
	expect(body instanceof Array).toBe(true);

	body.forEach(ev => {
		ev.mark && expect(ev.mark >= cutoff);
		!ev.mark && ev.coords && expect(ev.coords[2]).toBeLessThanOrEqual(new Date(cutoff).getTime());
	});
});

test('returns error if before is not a valid timestamp', async () => {
	const result = await callHandler(PATH, `?before=whocares`, null, true);
	const body = JSON.parse(result.body);

	expect(result.statusCode).toBe(400);
	expect(body instanceof Object).toBe(true);
	expect(body.error).toBe('before must be a valid timestamp or ISO datetime');
});

test('returns error if after and before are not valid timestamps', async () => {
	const result = await callHandler(PATH, `?after=whocares&before=whocares`, null, true);
	const body = JSON.parse(result.body);

	expect(result.statusCode).toBe(400);
	expect(body instanceof Object).toBe(true);
	expect(body.error).toBe('after must be a valid timestamp or ISO datetime, before must be a valid timestamp or ISO datetime');
});

test('returns only events whose name does not include specified strings', async () => {
	const targets = ['camera', 'space'];
	const result = await callHandler(PATH, `?nameNotIncludes=${targets.join(',')}`, null, true);
	const body = JSON.parse(result.body);

	expect(targets.length).toBeGreaterThan(0);
	expect(result.statusCode).toBe(200);
	expect(body instanceof Array).toBe(true);

	body.forEach(ev => {
		targets.forEach(target => {
			ev.name && expect(ev.name?.toLowerCase().includes(target.toLowerCase())).toBe(false);
		});
	});
});

test('returns only events that contain plates', async () => {
	const result = await callHandler(PATH, `?plateOnly=true`, null, true);
	const body = JSON.parse(result.body);

	expect(result.statusCode).toBe(200);
	expect(body instanceof Array).toBe(true);

	body.forEach(ev => {
		expect(ev.plates.length).toBeGreaterThan(0);
	});
});

test('returns only events that do not contain plates', async () => {
	const result = await callHandler(PATH, `?nonPlateOnly=true`, null, true);
	const body = JSON.parse(result.body);

	expect(result.statusCode).toBe(200);
	expect(body instanceof Array).toBe(true);

	body.forEach(ev => {
		expect(ev).not.toHaveProperty('plates');
	});
});

test('returns error when requesting events with plates and non-plates only', async () => {
	const result = await callHandler(PATH, `?nonPlateOnly=true&hasPlate=true`, null, true);
	const body = JSON.parse(result.body);

	expect(result.statusCode).toBe(400);
	expect(body instanceof Object).toBe(true);
	expect(body.error).toBe('hasPlate and nonPlateOnly are mutually exclusive');
});

test('returns error when requesting events with plates only and non-plates only', async () => {
	const result = await callHandler(PATH, `?nonPlateOnly=true&plateOnly=true`, null, true);
	const body = JSON.parse(result.body);

	expect(result.statusCode).toBe(400);
	expect(body instanceof Object).toBe(true);
	expect(body.error).toBe('plateOnly and nonPlateOnly are mutually exclusive');
});

test('returns only events that do not contain a youtubeId', async () => {
	const result = await callHandler(PATH, `?missingYoutubeIdOnly=true`, null, true);
	const body = JSON.parse(result.body);

	expect(result.statusCode).toBe(200);
	expect(body instanceof Array).toBe(true);

	body.forEach(ev => {
		expect(ev).not.toHaveProperty('youtubeId');
	});
});

test('returns only events that are within the specified radius of the specified point', async () => {
	const targetPoint = [42.493502, -71.105753];
	const maxRadius = 10;
	const result = await callHandler(PATH, `?targetPoint=${targetPoint.join(',')}&maxRadius=${maxRadius}`, null, true);
	const body = JSON.parse(result.body);

	expect(result.statusCode).toBe(200);
	expect(body instanceof Array).toBe(true);

	body.forEach(ev => {
		const distance = geolib.getDistance(
			{ latitude: ev.coords[0], longitude: ev.coords[1] },
			{ latitude: targetPoint[0], longitude: targetPoint[1] },
		);
		expect(distance).toBeLessThanOrEqual(maxRadius);
	});
});

test('returns error when maxRadius is used without targetPoint', async () => {
	const result = await callHandler(PATH, `?&maxRadius=10`, null, true);
	const body = JSON.parse(result.body);

	expect(result.statusCode).toBe(400);
	expect(body instanceof Object).toBe(true);
	expect(body.error).toBe('targetPoint must be provided');
});
