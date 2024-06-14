const fs = require('fs/promises');
const fss = require('fs');
const path = require('path');
const https = require('https');
const geolib = require('geolib');

let builtInLog = console.log;
console.log = (...args) => builtInLog(`[${new Date().toISOString()}] ${args}`);

const expectedMetaPath = path.resolve(`${__dirname}/../../../../walk-routes/meta_archive`);
if (!fss.existsSync(expectedMetaPath)) {
	throw new Error(`Expected directory [${expectedMetaPath}] does not exist`);
}

const express = require('express');

var privateKey  = fss.readFileSync('./generated/cert.key', 'utf8');
var certificate = fss.readFileSync('./generated/cert.pem', 'utf8');

var credentials = { key: privateKey, cert: certificate };

const app = express();
app.use(express.json({ limit: '1mb' }));

const port = 443;

app.all('*', (req, res, next) => {
	res.set('Access-Control-Allow-Origin', '*');
	res.set('Access-Control-Allow-Headers', '*');
	next();
});

app.post('/events', async (req, res) => {
	try {
		const { body } = req;
		await addDate(body);

		res.status(200);
		res.send(JSON.stringify({ message: `Successfully processed events for ${body.date}` }));
	} catch (e) {
		console.error(e);
		res.status(400);
	} finally {
		res.end();
	}
});

app.get('/events', async (req, res) => {
	const { date } = req.query;
	if (!date || !date.match(/\d{4}-\d{2}-\d{2}/)) {
		res.status(400);
		return res.end();
	}

	const [year, month, day] = date.split('-');

	const expectedYearPath = path.resolve(`${expectedMetaPath}/${year}`);
	if (!fss.existsSync(expectedYearPath)) {
		res.status(404);
		return res.end();
	}

	const expectedMonthPath = path.resolve(`${expectedYearPath}/${month}`);
	if (!fss.existsSync(expectedMonthPath)) {
		res.status(404);
		return res.end();
	}

	const expectedFilePath = path.resolve(`${expectedMonthPath}/${day}.json`);
	if (!fss.existsSync(expectedFilePath)) {
		res.status(404);
		return res.end();
	}

	const content = await fs.readFile(expectedFilePath, 'utf8');
	res.set('Content-Type', 'application/json');
	res.send(content);
	res.end();
});

app.post('/setYoutubeId', async (req, res) => {
	try {
		const { body: { date, id } } = req;

		const [year, month, day] = date.split('-');

		const expectedYearPath = path.resolve(`${expectedMetaPath}/${year}`);
		if (!fss.existsSync(expectedYearPath)) {
			res.status(404);
			return res.end();
		}

		const expectedMonthPath = path.resolve(`${expectedYearPath}/${month}`);
		if (!fss.existsSync(expectedMonthPath)) {
			res.status(404);
			return res.end();
		}

		const expectedFilePath = path.resolve(`${expectedMonthPath}/${day}.json`);
		if (!fss.existsSync(expectedFilePath)) {
			res.status(404);
			return res.end();
		}

		const content = await fs.readFile(expectedFilePath, 'utf8');
		const parsed = JSON.parse(content);
		parsed.youtubeId = id;
		await fs.writeFile(expectedFilePath, JSON.stringify(parsed, null, '  '));

		console.log(`Write [${expectedFilePath}] with youtubeId added [${id}]`);

		res.status(200);
		res.send('OK');
		res.end();
	} catch (e) {
		console.error(e);
		res.status(400);
		res.send(e.message);
		res.end();
	}
});

app.get('/', (req, res) => {
	res.status(200);
	res.send('OK');
	res.end();
});

const server = https.createServer(credentials, app);
server.listen(port, () => console.log(`Listening on [${port}]`));

async function addDate(body) {
	const [year, month, day] = body.date.split('-');

	const expectedYearPath = path.resolve(`${expectedMetaPath}/${year}`);
	if (fss.existsSync(expectedYearPath)) {
	} else {
		await fs.mkdir(expectedYearPath);
	}

	const expectedMonthPath = path.resolve(`${expectedYearPath}/${month}`);
	if (fss.existsSync(expectedMonthPath)) {
	} else {
		await fs.mkdir(expectedMonthPath);
	}

	const expectedFilePath = path.resolve(`${expectedMonthPath}/${day}.json`);
	if (fss.existsSync(expectedFilePath)) {
		throw new Error(`File already exists at [${expectedFilePath}]`);
	}

	const bodyWithDistance = addDistance(body);

	await fs.writeFile(expectedFilePath, JSON.stringify(bodyWithDistance, null, '  '));

	console.log(`Wrote [${expectedFilePath}}] with distance added`);
}

function addDistance(body) {
	const copy = JSON.parse(JSON.stringify(body));

	copy.distance = parseFloat(copy.coords.reduce((acc, cur, idx, arr) => {
		if (idx < arr.length - 1) {
			const next = arr[idx + 1];
			return acc + geolib.getDistance(
				{ latitude: cur.lat, longitude: cur.lon },
				{ latitude: next.lat, longitude: next.lon },
				1e-3,
			);
		}
		return acc;
	}, 0).toFixed(3));

	return copy;
}