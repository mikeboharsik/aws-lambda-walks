const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');

const getGeneratedPath = require('../util/getGeneratedPath');

async function getEvent(id) {
	const eventsPath = getGeneratedPath('events');
	const jsonPaths = fs.readdirSync(eventsPath);
	const prefixLength = jsonPaths[0].split('.')[0].length;
	const idPrefix = id.slice(0, prefixLength);
	const targetPath = path.resolve(eventsPath, `${idPrefix}.json`);
	if (!fs.existsSync(targetPath)) {
		throw new Error('Failed to find requested event');
	}

	const events = JSON.parse(await fsPromises.readFile(targetPath));
	return events.find(ev => ev.id === id);
}

module.exports = getEvent;