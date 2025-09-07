const http = require('http');
const { callHandler } = require('./callHandler');

const server = http.createServer(async (req, res) => {
	const [path, query] = req.url.split('?');
	const result = await callHandler(path, query, req.headers, true);
	res.writeHead(result.statusCode, { 'Access-Control-Allow-Origin': '*' });
	res.write(result.body || '');
	res.end();
});

server.listen(2312);
