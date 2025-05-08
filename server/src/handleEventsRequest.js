const fsPromises = require('fs/promises');

const geolib = require('geolib');

const { setJsonContentType } = require('./setJsonContentType.js');
const { getBenchmarkedFunctionAsync } = require('./getBenchmarkedFunction.js');

async function getAllEvents(event) {
	const content = await fsPromises.readFile(`${process.env.GENERATED_PATH || '.'}/events/all.json`);
	return JSON.parse(content);
}
const getAllEventsBenched = getBenchmarkedFunctionAsync(getAllEvents);

function getPointFeatureFromEvent(event) {
	return {
		properties: {
			name: event.name,
			plates: event.plates?.map(e => `${e[0]} ${e[1]}`).join(', '),
		},
		geometry: {
			coordinates: [event.coords[1], event.coords[0]],
			type: 'Point',
		},
		type: 'Feature',
	};
}

async function handleEventsRequest(event) {
	let {
		isAuthed,
		queryStringParameters: {
			targetPoint = null,
			after = null,
			before = null,
			plateOnly = false,
			nonPlateOnly = false,
			maxRadius = null,
		} = {},
	} = event;

  if (!isAuthed) {
    return {
      statusCode: 401
    };
  }

	try {
		if (plateOnly && nonPlateOnly) {
			throw new Error('plateOnly and nonPlateOnly are mutually exclusive');
		}
		if (!targetPoint && maxRadius) {
			throw new Error('targetPoint must be provided');
		}

		const allEvents = await getAllEventsBenched();

		let hits = [];
		if (maxRadius) {
			const [targetLat, targetLon] = targetPoint.split(',').map(e => parseFloat(e));
			hits = allEvents.reduce((acc, event) => {
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
		} else {
			hits = allEvents;
		}

		if (plateOnly) {
			hits = hits.filter(e => e.plates.length);
		}
		if (nonPlateOnly) {
			hits = hits.filter(e => e.name && !e.plates.length);
		}
	
		const geojson = {
			type: "FeatureCollection",
			features: hits.map(getPointFeatureFromEvent),
		};

		return setJsonContentType({
			statusCode: 200,
			body: JSON.stringify(geojson),
		});
	} catch (e) {
		console.error('Failed to load proximity events', e);
		return setJsonContentType({
			statusCode: 400,
			body: JSON.stringify({ error: e.message }),
		});
	}
}

module.exports = {
	handleEventsRequest
};
