const { firefox } = require('playwright');
const WalkFileManager = require('../../../walk-routes/utility/WalkFileManager');
const { getGeoJsonFromCoords } = require('../../server/src/getGeoJsonFromCoords');
const privacyZones = require('../../../walk-routes/meta_archive/privacyZones.json');

async function run(urlToScreenshot, date, idx, zoom) {

	try {
		const browser = await firefox.launch();
		const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
		const page = await context.newPage();
		await page.goto(urlToScreenshot);
		await page.click('.mapboxgl-canvas');
		await page.waitForTimeout(3000);

		const pageUrl = page.url();
		const [, zoomLevel] = pageUrl.match(/#map=(.+?)\/.+?\/.+?/);
		let newZoomLevel;
		if (zoom) {
			newZoomLevel = zoom;
		} else {
			newZoomLevel = parseFloat(zoomLevel) - 0.5;
			console.log(zoomLevel, newZoomLevel);
		}
		const newZoomUrl = pageUrl.replace(zoomLevel, parseFloat(newZoomLevel));
		console.log(pageUrl, newZoomUrl);
		await page.goto(newZoomUrl);

		await page.waitForTimeout(3000);
		await page.screenshot({
			clip: {
				x: 96,
				y: 196,
				width: 1280,
				height: 720,
			},
			quality: 95,
			path: `D:/wip/walks/clips/output/${date}_${idx}_thumbnail.jpeg`,
			fullPage: true,
		});
		await browser.close();
	} catch (e) {
		console.error('Failed to load remote route:', e.message);
		throw e;
	}
}

async function saveScreenshot(date, idx = 0, zoom) {
	if (!date) {
		console.error('Missing date');
		process.exit(1);
	}

	try {
		const manager = new WalkFileManager();
		const walksForDate = await manager.loadWalksForDate(date);
		const walk = walksForDate[idx];
		const geojson = {
			type: 'FeatureCollection',
			features: [getGeoJsonFromCoords(walk.coords, false, privacyZones)],
		};
		const encodedGeojson = encodeURIComponent(JSON.stringify(geojson));
		const urlToScreenshot = `https://geojson.io/#data=data:application/json,${encodedGeojson}`;
		await run(urlToScreenshot, date, idx, zoom);
	} catch (e) {
		console.error('Failed to load local walk, trying remote', e);
		const urlToScreenshot = await fetch(`https://2milesaday.com/api/routes?date=${date}&idx=${idx}`, { headers: { accept: 'text/plain' } }).then(r => r.text());
		await run(urlToScreenshot, date, idx, zoom);
	}
}

module.exports = { saveScreenshot };
