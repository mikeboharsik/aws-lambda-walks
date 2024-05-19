const fs = require('fs/promises');
const fss = require('fs');
const path = require('path');
const https = require('https');

const expectedMetaPath = path.resolve(`${__dirname}/../../../../walk-routes/meta_archive`);
if (!fss.existsSync(expectedMetaPath)) {
	throw new Error(`Expected directory [${expectedMetaPath}] does not exist`);
}

const express = require('express');

var privateKey  = fss.readFileSync('./generated/cert.key', 'utf8');
var certificate = fss.readFileSync('./generated/cert.pem', 'utf8');

var credentials = { key: privateKey, cert: certificate };

const app = express();
app.use(express.json());

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

app.get('/', (req, res) => {
	res.status(200);
	res.send('OK');
	res.end();
});

const server = https.createServer(credentials, app);
server.listen(port, () => console.log(`Listening on [${port}]`));

async function addDate(body) {
	const [year, month, date] = body.date.split('-');

	const expectedYearPath = path.resolve(`${expectedMetaPath}/${year}`);
	if (fss.existsSync(expectedYearPath)) {
		console.log(`${expectedYearPath} exists`);
	} else {
		await fs.mkdir(expectedYearPath);
	}

	const expectedMonthPath = path.resolve(`${expectedYearPath}/${month}`);
	if (fss.existsSync(expectedMonthPath)) {
		console.log(`${expectedMonthPath} exists`);
	} else {
		await fs.mkdir(expectedMonthPath);
	}

	const expectedFilePath = path.resolve(`${expectedMonthPath}/${body.date}.json`);
	if (fss.existsSync(expectedFilePath)) {
		throw new Error(`File already exists at [${expectedFilePath}]`);
	}

	await fs.writeFile(expectedFilePath, JSON.stringify(body, null, '  '));
}