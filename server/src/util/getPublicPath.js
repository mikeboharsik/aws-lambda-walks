const path = require('path');

function getPublicPath(subfolder = null) {
	const rootPath = path.resolve(process.env.PUBLIC_PATH || './public');

	if (subfolder) {
		return path.resolve(rootPath, subfolder);
	}
	
	return rootPath;
}

module.exports = getPublicPath;
