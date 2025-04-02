const fsPromises = require('fs/promises');

const { setJsonContentType } = require('./setJsonContentType.js');
const { getBenchmarkedFunctionAsync } = require('./getBenchmarkedFunction.js');

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

	let result = JSON.parse(await fsPromises.readFile(`./plates/plates.json`));

	if (filterByName !== false) {
		console.log(`Applying filterByName [${filterByName}]`);
		result = Object.keys(result)
			.filter(key => result[key].some(event => event.name))
			.reduce((acc, key) => {
				acc[key] = result[key];
				return acc;
			}, {});
	}
	if (nameContains !== false) {
		console.log(`Applying nameContains [${nameContains}]`);
		result = Object.keys(result)
			.reduce((acc, key) => {
				acc[key] = result[key].filter(e => e.name?.toUpperCase().includes(nameContains.toUpperCase()));
				return acc;
			}, {});
	}
	if (filterByCount !== false) {
		console.log(`Applying filterByCount [${filterByCount}]`);
		result = Object.keys(result)
			.filter(key => result[key].length >= filterByCount)
			.reduce((acc, key) => {
				acc[key] = result[key];
				return acc;
			}, {});
	}
	if (sortByCount !== false) {
		console.log(`Applying sortByCount [${sortByCount}]`);
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

async function handlePlatesRequest(event) {
	const { isAuthed, headers: { accept } } = event;
  if (!isAuthed) {
    return {
      statusCode: 401
    };
  }

	try {
		const parsed = await getAllEventsByPlateBenched(event);
		const isCsv = accept === 'text/csv';
		return {
			statusCode: 200,
			body: isCsv ? parsed : JSON.stringify(parsed),
			headers: { 'content-type': isCsv ? 'text/csv' : 'application/json' }
		};
	} catch (e) {
		console.error('Failed to load plates', e);
		return setJsonContentType({
			statusCode: 400,
			body: JSON.stringify({ error: e.message }),
		});
	}
}

module.exports = {
	handlePlatesRequest
};
