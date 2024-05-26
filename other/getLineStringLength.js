const fs = require('fs/promises');
const path = require('path');
const { getDistance } = require('geolib');

const [,, targetFile] = process.argv;

(async function getPointsDistance() {
	try {
		const parsed = JSON.parse(await fs.readFile(targetFile));
		const points = parsed.coords.map(({ lat, lon }) => ({ latitude: lat, longitude: lon }));
		const distance = points.reduce((acc, cur, idx, arr) => {
			if (idx < points.length - 1) {
				return acc + getDistance(cur, arr[idx + 1], 1e-3);
			} else {
				return acc;
			}
		}, 0);
		console.log(distance.toFixed(3));
	} catch (e) {
		console.error(e);
	}
})();