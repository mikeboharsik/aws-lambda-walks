const fsPromises = require('fs/promises');

const { setJsonContentType } = require('./setJsonContentType.js');
const { getBenchmarkedFunctionAsync } = require('./getBenchmarkedFunction.js');

async function getCoordsByMonth(month) {
	return JSON.parse(await fsPromises.readFile(`./coords/${month}.json`));
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

		newEntry.properties.date = walk.date;
		if (walk.route) {
			newEntry.properties.route = walk.route;
		}

		acc.push(newEntry);
		return acc;
	}, []);

	geojson = {
		type: "FeatureCollection",
		features: geojson,
	};

	const encodedRouteData = encodeURIComponent(JSON.stringify(geojson));

	const body = `
	<html>
		<body>
			<script>
				window.location = 'https://geojson.io/#data=data:application/json,${encodedRouteData}';
			</script>
		</body>
	</html>`;

	return {
		statusCode: 200,
		body,
		headers: { 
			'content-type': 'text/html'
		}
	};
}

module.exports = {
	handleWalkRouteRequest
};
