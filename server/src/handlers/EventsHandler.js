const geolib = require('geolib');

const { ApiRequestHandler } = require('./ApiRequestHandler');

const getAllEvents = require('../util/getAllEvents.js');
const getEvent = require('../util/getEvent.js');

class EventsHandler extends ApiRequestHandler {
	constructor() {
		super();
		this.path = /\/events/;
		this.requiresAuth = true;
	}

	getPointFeatureFromEvent(event) {
		const resiProps = event.resi ? {
			"marker-color": "#fd0006",
			"marker-size": "medium",
			"marker-symbol": "circle"
		} : {};
		return {
			properties: {
				id: event.id,
				name: event.name,
				time: event.coords.at(2) || 'Unknown',
				tags: event.tags,
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

	async validateRequest(event) {
		const {
			queryStringParameters: {
				targetPoint = null,
				plateOnly = false,
				nonPlateOnly = false,
				maxRadius = null,
				hasPlate = null,
			} = {},
		} = event;

		if (hasPlate && nonPlateOnly) {
			throw new Error('hasPlate and nonPlateOnly are mutually exclusive');
		}
		if (plateOnly && nonPlateOnly) {
			throw new Error('plateOnly and nonPlateOnly are mutually exclusive');
		}
		if (!targetPoint && maxRadius) {
			throw new Error('targetPoint must be provided');
		}
	}

	async process(event) {
		try {
			this.validateRequest(event);

			let {
				queryStringParameters: {
					id = null,
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

			if (id) {
				try {
					const event = await getEvent(id);
					if (event) {
						return this.getJsonResponse(200, event);
					} else {
						throw new Error(`Failed to find event ${id}`);
					}
				} catch (e) {
					return this.getJsonResponse(404, { error: e.message });
				}
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
					features: hits.map(this.getPointFeatureFromEvent),
				};
		
				return this.getGeoJsonResponse(200, JSON.stringify(geojson));
			} else {
				return this.getJsonResponse(200, JSON.stringify(hits));
			}
		} catch (e) {
			console.error('Failed to load proximity events', e);
			return this.getJsonResponse(400, JSON.stringify({ error: e.message }));
		}
	}
}

module.exports = {
	EventsHandler,
};