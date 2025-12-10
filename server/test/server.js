const http = require('http');
const { callHandler } = require('./callHandler');

const port = 2312;

process.env.ENABLE_LOGGING = true;

const disableAuth = process.argv[2] === 'true';
console.log({ disableAuth });

const server = http.createServer(async (req, res) => {
	const [path, query] = req.url.split('?');
	const result = await callHandler(path, query, req.headers, !disableAuth);
	res.writeHead(result.statusCode, { 'Access-Control-Allow-Origin': '*', ...result.headers });
	res.write(result.body || '');
	res.end();
});

server.listen(port, () => console.log(`Listening on port ${port}`));
