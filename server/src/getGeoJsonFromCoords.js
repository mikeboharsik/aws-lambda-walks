const geolib = require('geolib');

const privacyZones = JSON.parse(process.env.PRIVACY_ZONES ?? '[]');

function getGeoJsonFromCoords(coords, isAuthed) {
	let coordinates = coords.map(({ lat, lon }) => [lon, lat]);

	if (!isAuthed) {
		coordinates = coordinates.filter(([longitude, latitude]) => {
			return !privacyZones.some((zone) => {
				return geolib.isPointWithinRadius({ latitude, longitude }, zone.coords, zone.radius);
			});
		});
	}

	return {
		type: "Feature",
		properties: {},
		geometry: {
			type: "LineString",
			coordinates,
		}
	};
}

module.exports = { 
	getGeoJsonFromCoords
};
