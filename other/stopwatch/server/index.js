const fs = require('fs');
const https = require('https');

const express = require('express');

var privateKey  = fs.readFileSync('./generated/server.key', 'utf8');
var certificate = fs.readFileSync('./generated/server.crt', 'utf8');

var credentials = { key: privateKey, cert: certificate };

const app = express();
app.use(express.json());

const port = 40219;

app.all('*', (req, res, next) => {
	res.set('Access-Control-Allow-Origin', '*');
	res.set('Access-Control-Allow-Header', '*');
	next();
});

app.post('/events', (req, res) => {
	const { body: { date, events } } = req;
	console.log({ date, events });
	res.status(200);
	res.send('OK');
	res.end();
});

app.get('/', (req, res) => {
	res.status(200);
	res.send('OK');
	res.end();
});

const server = https.createServer(credentials, app);
server.listen(port, () => console.log(`Listening on [${port}]`));
