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
				after = null,
				before = null,
				targetPoint = null,
				plateOnly = false,
				nonPlateOnly = false,
				maxRadius = null,
				hasPlate = null,
			} = {},
		} = event;

		const errors = [];

		if (hasPlate && nonPlateOnly) {
			errors.push('hasPlate and nonPlateOnly are mutually exclusive');
		}
		if (plateOnly && nonPlateOnly) {
			errors.push('plateOnly and nonPlateOnly are mutually exclusive');
		}
		if (!targetPoint && maxRadius) {
			errors.push('targetPoint must be provided');
		}
		if (after && isNaN(after)) {
			const datetime = new Date(after);
			if (isNaN(datetime)) {
				errors.push('after must be a valid timestamp or ISO datetime');
			} else {
				event.queryStringParameters.after = datetime.getTime();
			}
		}
		if (before && isNaN(before)) {
			const datetime = new Date(before);
			if (isNaN(datetime)) {
				errors.push('before must be a valid timestamp or ISO datetime');
			} else {
				event.queryStringParameters.before = datetime.getTime();
			}
		}

		if (errors.length) {
			throw new Error(errors.join(', '));
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
					missingYoutubeIdOnly = false,
					nameIncludes = null,
					nameNotIncludes = null,
					select = null,
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
			
			if (after) {
				hits = hits.filter(e => (e.timestamp && e.timestamp >= after) || (e.mark && e.mark >= after));
			}

			if (before) {
				hits = hits.filter(e => (e.timestamp && e.timestamp <= before) || (e.mark && e.mark <= before));
			}

			if (nameIncludes) {
				const targets = nameIncludes.split(',').map(e => e.toLowerCase());
				targets.forEach(target => {
					hits = hits.filter(e => e.name && e.name.toLowerCase().includes(target));
				});
			}

			if (nameNotIncludes) {
				const targets = nameNotIncludes.split(',').map(e => e.toLowerCase());
				targets.forEach(target => {
					hits = hits.filter(e => !e.name || !e.name.toLowerCase().includes(target));
				});
			}

			if (maxRadius) {
				const [targetLat, targetLon] = targetPoint.split(',').map(e => parseFloat(e));
				hits = hits.reduce((acc, event) => {
					if (!event.coords) return acc;

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
			if (missingYoutubeIdOnly) {
				hits = hits.filter(e => !e.youtubeId);
			}

			hits.forEach(e => {
				delete e.walkStartTime;
				delete e.walkTrimmedOffset;
				delete e.walkExif;
			});

			hits.sort((a, b) => {
				const aTime = a.coords?.[2] || a.mark;
				const bTime = b.coords?.[2] || b.mark; 
				return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
			});

			if (select) {
				select = select.split(',');
				hits = hits.reduce((acc, hit) => {
					const truncated = {};
					select.forEach(prop => truncated[prop] = hit[prop]);
					acc.push(truncated);
					return acc;
				}, []);
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