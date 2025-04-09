const fsPromises = require('fs/promises');

const geolib = require('geolib');

const { setJsonContentType } = require('./setJsonContentType.js');
const { getBenchmarkedFunctionAsync } = require('./getBenchmarkedFunction.js');

async function getAllEvents(event) {
	const content = await fsPromises.readFile('./events/all.json');
	return JSON.parse(content);
}
const getAllEventsBenched = getBenchmarkedFunctionAsync(getAllEvents);

async function handleEventsProximityRequest(event) {
	let {
		isAuthed,
		queryStringParameters: {
			targetPoint = null,
			after = null,
			before = null,
			plateOnly = false,
			nonPlatesOnly = false,
			maxRadius = 20,
		} = {},
	} = event;
  if (!isAuthed) {
    return {
      statusCode: 401
    };
  }

	try {
		if (!targetPoint) {
			throw new Error('targetPoint must be provided');
		}

		const [targetLat, targetLon] = targetPoint.split(',').map(e => parseFloat(e));

		const allEvents = await getAllEventsBenched();

		const hits = allEvents.reduce((acc, event) => {
			if (!event.coords) return acc;
			if (before && event?.mark >= before) return acc; 
			if (after && event?.mark <= after) return acc;

			const [lat, lon] = event.coords;
			const isHit = geolib.isPointWithinRadius(
				{ latitude: lat, longitude: lon },
				{ latitude: targetLat, longitude: targetLon },
				maxRadius,
			);
			if (isHit) {
				acc.push(event);
			}
			return acc;
		}, []);

		return {
			statusCode: 200,
			body: JSON.stringify(hits),
			headers: { 'content-type': 'text/html' }
		};
	} catch (e) {
		console.error('Failed to load proximity events', e);
		return setJsonContentType({
			statusCode: 400,
			body: JSON.stringify({ error: e.message }),
		});
	}
}

module.exports = {
	handleEventsProximityRequest
};
