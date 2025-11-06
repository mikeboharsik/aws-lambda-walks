const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const { getBenchmarkedFunctionAsync } = require('./getBenchmarkedFunction.js');
const getGeneratedPath = require('./getGeneratedPath.js');

async function getAllEvents() {
	const eventsPath = getGeneratedPath('events');
	const jsonPaths = fs.readdirSync(eventsPath);
	const jobLimit = 1000;
	const allEvents = [];
	for (let i = 0; i < jsonPaths.length; i += jobLimit) {
		const jobs = jsonPaths.map(async filePath => {
			const eventsMap = JSON.parse(await fsPromises.readFile(path.resolve(eventsPath, filePath)));
			return Object.values(eventsMap);
		});
		const events = await Promise.all(jobs);
		allEvents.push(...events);
	}
	return allEvents.flatMap(e => e);
}
const getAllEventsBenched = getBenchmarkedFunctionAsync(getAllEvents);

module.exports = getAllEventsBenched;
