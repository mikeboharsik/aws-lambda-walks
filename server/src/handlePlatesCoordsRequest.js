const fsPromises = require('fs/promises');

const { setJsonContentType } = require('./setJsonContentType.js');

async function handlePlatesCoordsRequest(event) {
	const { isAuthed, queryStringParameters: { plate = null, date = null } = {} } = event;
  if (!isAuthed) {
    return {
      statusCode: 401
    };
  }

	if (!plate && !date) {
		return setJsonContentType({
			statusCode: 400,
			body: JSON.stringify({ error: 'plate or date must be specified' })
		});
	}

	try {
		const parsed = JSON.parse(await fsPromises.readFile(`./progressiveStats/plates.json`));

		const filterKey = plate ? 'plate' : 'date';

		const features = parsed.filter(e => e[filterKey] === (plate || date));

		const geoJson = {
			type: 'FeatureCollection',
			features: features.map(({ coords, date, plate }) => {
				return {
					type: 'Feature',
					properties: { date, plate },
					geometry: {
						coordinates: [
							parseFloat(coords[1]),
							parseFloat(coords[0]),
						],
						type: 'Point',
					}
				}
			}),
		};

		const encodedGeojsonData = encodeURIComponent(JSON.stringify(geoJson));

		const body = `
<html>
	<body>
		<script>
			window.location = 'https://geojson.io/#data=data:application/json,${encodedGeojsonData}';
		</script>
	</body>
</html>`;

		return {
			statusCode: 200,
			body,
			headers: { 'content-type': 'text/html' },
		};
	} catch (e) {
		console.error('Failed to load plate coords', e);
		return setJsonContentType({
			statusCode: 400,
			body: JSON.stringify({ error: e.message }),
		});
	}
}

module.exports = {
	handlePlatesCoordsRequest
};
