const { firefox } = require('playwright');

async function saveScreenshot() {
	const [,, date, idx = 0] = process.argv;

	if (!date) {
		console.error('Missing date');
		process.exit(1);
	}

	try {
		const geojsonUrl = await fetch(`https://2milesaday.com/api/routes?date=${date}&idx=${idx}`, { headers: { accept: 'text/plain' } }).then(r => r.text());

		const browser = await firefox.launch();
		const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
		const page = await context.newPage();
		await page.goto(geojsonUrl);
		await page.click('.mapboxgl-canvas');
		await page.waitForTimeout(1500);

		const pageUrl = page.url();
		const [, zoomLevel] = pageUrl.match(/#map=(.+?)\/.+?\/.+?/);
		const newZoomLevel = parseFloat(zoomLevel) - 0.5;
		console.log(zoomLevel, newZoomLevel);
		const newZoomUrl = pageUrl.replace(zoomLevel, parseFloat(newZoomLevel));
		console.log(pageUrl, newZoomUrl);
		await page.goto(newZoomUrl);

		await page.waitForTimeout(500);
		await page.screenshot({
			clip: {
				x: 96,
				y: 196,
				width: 1280,
				height: 720,
			},
			path: `D:/wip/walks/clips/output/${date}_${idx}_thumbnail.jpeg`,
			fullPage: true,
		});
		await browser.close();
	} catch (e) {
		console.error(e.message);
		process.exit(1);
	}
}

saveScreenshot();