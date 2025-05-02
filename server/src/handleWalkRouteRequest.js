const fsPromises = require('fs/promises');

const { setJsonContentType } = require('./setJsonContentType.js');
const { getBenchmarkedFunctionAsync } = require('./getBenchmarkedFunction.js');
const { getGeoJsonFromCoords } = require('./getGeoJsonFromCoords.js');

async function getCoordsByMonth(month) {
	return JSON.parse(await fsPromises.readFile(`${process.env.GENERATED_PATH || '.'}/coords/${month}.json`));
}
const getCoordsByMonthBenched = getBenchmarkedFunctionAsync(getCoordsByMonth);

async function handleWalkRouteRequest(event) {
	const { isAuthed, queryStringParameters: { date } } = event;

	if (!date?.match(/\d{4}-\d{2}-\d{2}/)) {
		return setJsonContentType({
			statusCode: 400,
			body: JSON.stringify({ error: "date must be provided and in yyyy-MM-dd format" }),
		});
	}

	const [month] = date.match(/\d{4}-\d{2}/);

	const parsed = await getCoordsByMonthBenched(month);
	const target = parsed.filter(e => e.date === date);

	let geojson = target.reduce((acc, walk) => {
		const newEntry = getGeoJsonFromCoords(walk.coords, isAuthed);

		newEntry.properties = {
			date: walk.date,
			stroke: "#ff0000",
			"stroke-width": 5,
			"stroke-opacity": 1
		};

		acc.push(newEntry);
		return acc;
	}, []);

	geojson = {
		type: "FeatureCollection",
		features: geojson,
	};

	let body = null;
	let contentType = null;
	switch (event.headers?.accept) {
		case 'application/geo+json': {
			body = JSON.stringify(geojson);
			contentType = 'application/geo+json';
			break;
		}
		case 'text/plain': {
			body = `https://geojson.io/#data=data:application/json,${encodeURIComponent(JSON.stringify(geojson))}`;
			contentType = 'text/plain';
			break;
		}
		case 'text/html':
		default: {
			const encodedRouteData = encodeURIComponent(JSON.stringify(geojson));
			body = `<html>
	<body>
		<script>
			window.location = 'https://geojson.io/#data=data:application/json,${encodedRouteData}';
		</script>
	</body>
</html>`;
			contentType = 'text/html';
			break;
		}
	}

	return {
		statusCode: 200,
		body,
		headers: { 
			'content-type': contentType
		}
	};
}

module.exports = {
	handleWalkRouteRequest
};
