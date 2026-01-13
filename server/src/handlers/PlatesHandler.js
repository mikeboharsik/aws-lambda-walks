const fsPromises = require('fs/promises');
const path = require('path');

const { ApiRequestHandler } = require('./ApiRequestHandler');

const { getBenchmarkedFunctionAsync } = require('../util/getBenchmarkedFunction.js');

const getGeneratedPath = require('../util/getGeneratedPath.js');

async function getAllEventsByPlate(event) {
	let {
		queryStringParameters: {
			filterByCount = false,
			filterByName = false,
			sortByCount = false,
			nameContains = false,
		} = {},
		headers: { accept },
	} = event;

	if (nameContains !== false) {
		filterByName = true;
	}

	if (filterByCount !== false) {
		filterByCount = parseInt(filterByCount, 10);
		if (isNaN(filterByCount) || filterByCount <= 0) {
			throw new Error('filterByCount must be a number greater than 0');
		}
	}

	const resolvedPath = path.resolve(`${getGeneratedPath()}/plates/plates.json`);
	let result = JSON.parse(await fsPromises.readFile(resolvedPath));

	if (filterByName !== false) {
		event.log(`Applying filterByName [${filterByName}]`);
		result = Object.keys(result)
			.filter(key => result[key].some(event => event.name))
			.reduce((acc, key) => {
				acc[key] = result[key];
				return acc;
			}, {});
	}
	if (nameContains !== false) {
		event.log(`Applying nameContains [${nameContains}]`);
		result = Object.keys(result)
			.reduce((acc, key) => {
				acc[key] = result[key].filter(e => e.name?.toUpperCase().includes(nameContains.toUpperCase()));
				return acc;
			}, {});
	}
	if (filterByCount !== false) {
		event.log(`Applying filterByCount [${filterByCount}]`);
		result = Object.keys(result)
			.filter(key => result[key].length >= filterByCount)
			.reduce((acc, key) => {
				acc[key] = result[key];
				return acc;
			}, {});
	}
	if (sortByCount !== false) {
		event.log(`Applying sortByCount [${sortByCount}]`);
		result = Object.keys(result)
			.toSorted((a, b) => result[a].length > result[b].length ? -1 : result[a].length < result[b].length ? 1 : 0)
			.reduce((acc, key) => {
				acc[key] = result[key];
				return acc;
			}, {});
	}

	const keys = Object.keys(result);
	for (let key of keys) {
		if (!result[key].length) {
			delete result[key];
		}
	}

	if (accept === 'text/csv') {
		const header = `"plate","date","name","link","resi"\n`;
		result = header + Object.keys(result).reduce((acc, plate) => {
			const plateEvents = result[plate];
			plateEvents.forEach(({ date, name, link, resi }) => {
				const line = `"${plate}","${date}","${name || ''}","${link || ''}","${resi || ''}"`;
				acc.push(line);
			});
			return acc;
		}, []).join('\n');
	}

	return result;
}
const getAllEventsByPlateBenched = getBenchmarkedFunctionAsync(getAllEventsByPlate);

class PlatesHandler extends ApiRequestHandler {
	constructor() {
		super();
		this.path = /^\/plates$/;
		this.requiresAuth = true;
	}

	async process(event) {
		const { headers: { accept }, rawPath } = event;

		if (rawPath.endsWith('coords')) {
			const { queryStringParameters: { plate = null, date = null } = {} } = event;

			if (!plate && !date) {
				return this.getJsonResponse(400, JSON.stringify({ error: 'plate or date must be specified' }));
			}

			try {
				const resolvedPath = path.resolve(`${getGeneratedPath()}/progressiveStats/plates.json`);
				const parsed = JSON.parse(await fsPromises.readFile(resolvedPath));

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

				const body = `<html>
	<body>
		<script>
			window.location = 'https://geojson.io/#data=data:application/json,${encodedGeojsonData}';
		</script>
	</body>
</html>`;

				return this.getHtmlResponse(200, body);
			} catch (e) {
				event.logError('Failed to load plate coords', e);
				return this.getJsonResponse(400, JSON.stringify({ error: e.message }));
			}
		}

		try {
			const parsed = await getAllEventsByPlateBenched(event);
			const isCsv = accept === 'text/csv';
			return isCsv ? this.getCsvResponse(200, parsed) : this.getJsonResponse(200, JSON.stringify(parsed));
		} catch (e) {
			event.logError('Failed to load plates', e);
			return this.getJsonResponse(400, JSON.stringify({ error: e.message }));
		}
	}
};

module.exports = {
	PlatesHandler
};
