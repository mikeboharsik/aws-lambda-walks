const geolib = require('geolib');

const { setJsonContentType } = require('./setJsonContentType.js');
const { getAllEvents } = require('./getAllEvents.js');

function getPointFeatureFromEvent(event) {
	const resiProps = event.resi ? {
		"marker-color": "#fd0006",
		"marker-size": "medium",
		"marker-symbol": "circle"
	} : {};
	return {
		properties: {
			id: event.id,
			name: event.name,
			plates: event.plates?.map(e => `${e[0]} ${e[1]}`).join(', '),
			...resiProps
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
			hasPlate = null,
		} = {},
	} = event;

	const { headers: { accept } } = event;
	const acceptHeader = accept?.toLowerCase() || 'application/json';
	const didRequestGeoJson = acceptHeader === 'application/geo+json';

  if (!isAuthed) {
    return {
      statusCode: 401
    };
  }

	try {
		if (hasPlate && nonPlateOnly) {
			throw new Error('hasPlate and nonPlateOnly are mutually exclusive');
		}
		if (plateOnly && nonPlateOnly) {
			throw new Error('plateOnly and nonPlateOnly are mutually exclusive');
		}
		if (!targetPoint && maxRadius) {
			throw new Error('targetPoint must be provided');
		}

		let hits = await getAllEvents();
		if (didRequestGeoJson) {
			hits = hits.filter(e => e.coords);
		}

		if (hasPlate) {
			const validPlateCharacterPattern = /[^a-zA-Z0-9]/g;
			hasPlate = hasPlate.replace(validPlateCharacterPattern, '');
			hits = hits.filter(e => e.plates?.map(([state, value]) => state + value.replace(validPlateCharacterPattern, '')).includes(hasPlate));
		}
		
		if (maxRadius) {
			const [targetLat, targetLon] = targetPoint.split(',').map(e => parseFloat(e));
			hits = hits.reduce((acc, event) => {
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
		}

		if (plateOnly) {
			hits = hits.filter(e => e.plates?.length);
		}
		if (nonPlateOnly) {
			hits = hits.filter(e => e.name && !e.plates?.length);
		}
	
		if (didRequestGeoJson) {
			const geojson = {
				type: "FeatureCollection",
				features: hits.map(getPointFeatureFromEvent),
			};
	
			return setJsonContentType({
				statusCode: 200,
				headers: { 'content-type': 'application/geo+json' },
				body: JSON.stringify(geojson),
			});
		} else {
			return setJsonContentType({
				statusCode: 200,
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(hits),
			});
		}
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
