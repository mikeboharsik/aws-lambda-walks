const path = require('path');

function getGeneratedPath(subfolder = null) {
	const rootPath = path.resolve(process.env.GENERATED_PATH || '.');

	if (subfolder) {
		return path.resolve(rootPath, 'events');
	}
	
	return rootPath;
}

module.exports = getGeneratedPath;
