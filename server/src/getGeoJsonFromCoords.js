const geolib = require('geolib');

function getGeoJsonFromCoords(coords, isAuthed, privacyZones = JSON.parse(process.env.PRIVACY_ZONES ?? '[]')) {
	if (!privacyZones || !privacyZones.length) {
		throw new Error('Unsafe: no privacy zones defined');
	}

	let coordinates;

	if (coords.at(0) instanceof Array) {
		coordinates = coords.map(([ lat, lon ]) => [lon, lat]);
	} else {
		coordinates = coords.map(({ lat, lon }) => [lon, lat]);
	}

	if (!isAuthed) {
		coordinates = coordinates.filter(([longitude, latitude]) => {
			return !privacyZones.some((zone) => {
				return geolib.isPointWithinRadius({ latitude, longitude }, zone.coords, zone.radius);
			});
		});
	}

	return {
		type: "Feature",
		properties: {
			stroke: "#ff0000",
			'stroke-width': 5,
			'stroke-opacity': 1,
		},
		geometry: {
			type: "LineString",
			coordinates,
		}
	};
}

module.exports = { 
	getGeoJsonFromCoords
};
