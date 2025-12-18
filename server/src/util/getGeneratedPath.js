const path = require('path');

function getGeneratedPath(subfolder = null) {
	const rootPath = path.resolve(process.env.GENERATED_PATH || './generated');

	if (subfolder) {
		return path.resolve(rootPath, subfolder);
	}
	
	return rootPath;
}

module.exports = getGeneratedPath;
