const path = require('path');

function getGarbagePath() {
	return path.resolve(__dirname + '/../../garbage.txt');
}

module.exports = getGarbagePath;
