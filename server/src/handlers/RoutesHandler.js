const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');

const geolib = require('geolib');

const { ApiRequestHandler } = require('./ApiRequestHandler');

const { getBenchmarkedFunctionAsync } = require('../util/getBenchmarkedFunction.js');
const { getGeoJsonFromCoords } = require('../getGeoJsonFromCoords.js');

const getGeneratedPath = require('./util/getGeneratedPath.js');

async function getCoordsByMonth(month) {
	try {
		const resolvedPath = path.resolve(`${getGeneratedPath()}/coords/${month}.json`);
		return JSON.parse(await fsPromises.readFile(resolvedPath));
	} catch (e) {
		throw new Error(`Failed to load data for month ${month}`);
	}
}
const getCoordsByMonthBenched = getBenchmarkedFunctionAsync(getCoordsByMonth);

async function getAllCoords() {
	const coordsPath = `${getGeneratedPath()}/coords`;
	const monthFiles = fs.readdirSync(coordsPath);
	const jobs = monthFiles.map(async (file) => {
		const resolvedPath = path.resolve(coordsPath + '/' + file, 'utf8');
		return JSON.parse(fs.readFileSync(resolvedPath))
	});
	const allCoords = await Promise.all(jobs);
	return allCoords;
}
const getAllCoordsBenched = getBenchmarkedFunctionAsync(getAllCoords);

class RoutesHandler extends ApiRequestHandler {
	constructor() {
		super();
		this.path = /\/routes/;
		this.requiresAuth = false;
	}

	async process(event) {
		let { isAuthed, queryStringParameters: { date = null, idx = null, nearPoint = null, nearPointRadius = 20 } = {} } = event;
		if (!date && !nearPoint) {
			return this.getJsonResponse(400, { error: 'query parameter date or nearPoint must be provided' });
		}

		if (nearPoint) {
			nearPoint = nearPoint.split(',').map(e => parseFloat(e.trim()));
			const [targetLat, targetLon] = nearPoint;

			const allCoordsByMonth = await getAllCoordsBenched();

			const hitDates = [];
			allCoordsByMonth.forEach(month => {
				month.forEach(day => {
					if (day.bounds) {
						const { bounds: { minLat, minLng, maxLat, maxLng } } = day;
						const dayBoundingBox = [
							{ latitude: minLat, longitude: minLng },
							{ latitude: minLat, longitude: maxLng },
							{ latitude: maxLat, longitude: maxLng },
							{ latitude: maxLat, longitude: minLng },
							{ latitude: minLat, longitude: minLng },
						];
						if (!geolib.isPointInPolygon({ latitude: targetLat, longitude: targetLon }, dayBoundingBox)) {
							return;
						}
					}

					for (const [lat, lon] of (day?.coords || [])) {
						const isHit = geolib.isPointWithinRadius(
							{ latitude: lat, longitude: lon },
							{ latitude: targetLat, longitude: targetLon },
							nearPointRadius,
						);
						if (isHit) {
							hitDates.push(day.date);
							break;
						}
					}
				});
			});

			return this.getJsonResponse(200, hitDates);
		}

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
				if (!walk.coords) {
					throw new Error(`[${date}] walk [${walkIdx}] is missing coords`);
				}
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