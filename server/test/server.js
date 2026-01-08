const path = require('path');
require('dotenv').config({ path: [path.resolve(__dirname + '/../' + '.env')], quiet: true });
const http = require('http');
const { callHandler } = require('./callHandler');

const port = process.env.SERVER_PORT ?? 2312;

process.env.ENABLE_LOGGING = true;

const ignoreAuth = process.argv[2] === 'true';
console.log({ ignoreAuth });

const server = http.createServer(async (req, res) => {
	const [path, query] = req.url.split('?');
	const result = await callHandler(path, query, req.headers, ignoreAuth);
	res.writeHead(result.statusCode, { 'Access-Control-Allow-Origin': '*', ...result.headers });
	res.write(result.body || '');
	res.end();
});

server.listen(port, () => console.log(`Listening on port ${port}`));
