const fsPromises = require('fs/promises');

const { ApiRequestHandler } = require('./ApiRequestHandler');

const { getBenchmarkedFunctionAsync } = require('../getBenchmarkedFunction.js');
const { getGeoJsonFromCoords } = require('../getGeoJsonFromCoords.js');

async function getCoordsByMonth(month) {
	return JSON.parse(await fsPromises.readFile(`${process.env.GENERATED_PATH || '.'}/coords/${month}.json`));
}
const getCoordsByMonthBenched = getBenchmarkedFunctionAsync(getCoordsByMonth);

class RoutesHandler extends ApiRequestHandler {
	constructor() {
		super();
		this.path = /\/routes/;
		this.requiresAuth = false;
	}

	async process(event) {
		let { isAuthed, queryStringParameters: { date = null, idx = null } } = event;
		if (idx !== null) {
			idx = parseInt(idx);
		}

		if (!date?.match(/\d{4}-\d{2}-\d{2}/)) {
			return this.getJsonResponse(400, JSON.stringify({ error: 'date must be provided and in yyyy-MM-dd format' }));
		}
		if (isNaN(idx) || (idx !== null && idx < 0)) {
			return this.getJsonResponse(400, JSON.stringify({ error: 'idx must be at least 0' }));
		}

		const [month] = date.match(/\d{4}-\d{2}/);

		const allCoordsByMonth = await getCoordsByMonthBenched(month);
		const walksForTargetDate = allCoordsByMonth.filter(e => e.date === date);
		if (walksForTargetDate.length === 0) {
			return this.getJsonResponse(404, JSON.stringify({ error: `failed to find any walks for date ${date}` }));
		}

		if (idx !== null && idx > walksForTargetDate.length - 1) {
			return this.getJsonResponse(400, JSON.stringify({ error: `idx must be at least 0 and less than ${walksForTargetDate.length} for date ${date}, received [${idx}]` }));
		}

		let geojson = walksForTargetDate.reduce((acc, walk, walkIdx) => {
			if (idx === null || idx === walkIdx) {
				const newEntry = getGeoJsonFromCoords(walk.coords, isAuthed);

				newEntry.properties = {
					date: walk.date,
					stroke: "#ff0000",
					"stroke-width": 5,
					"stroke-opacity": 1
				};

				acc.push(newEntry);
			}
			return acc;
		}, []);

		geojson = {
			type: "FeatureCollection",
			features: geojson,
		};

		switch (event.headers?.accept) {
			case 'application/geo+json': {
				return this.getGeoJsonResponse(200, JSON.stringify(geojson));
			}
			case 'text/plain': {
				return this.getPlaintextResponse(200, `https://geojson.io/#data=data:application/json,${encodeURIComponent(JSON.stringify(geojson))}`);
			}
			case 'text/html':
			default: {
				const encodedRouteData = encodeURIComponent(JSON.stringify(geojson));
				const body = `<html>
	<body>
		<script>
			window.location = 'https://geojson.io/#data=data:application/json,${encodedRouteData}';
		</script>
	</body>
</html>`;
				return this.getHtmlResponse(200, body);
			}
		}
	}
};

module.exports = {
	RoutesHandler,
};