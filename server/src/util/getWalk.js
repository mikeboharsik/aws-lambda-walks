const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');

const getGeneratedPath = require('./getGeneratedPath');

async function getWalk(date) {
	const walksPath = getGeneratedPath('walks');
	const targetPath = path.resolve(walksPath, `${date}.json`);
	if (!fs.existsSync(targetPath)) {
		throw new Error('Failed to find requested event');
	}

	const walk = JSON.parse(await fsPromises.readFile(targetPath));
	return walk;
}

module.exports = getWalk;