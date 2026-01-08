const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');

const getPublicPath = require('./util/getPublicPath.js');
const { makeQueryStringParametersSafe } = require('./makeQueryStringParametersSafe.js');

const publicPath = getPublicPath();

async function handleContentRequest(event) {
	const { rawPath } = event;

	console.log('handle content request', rawPath, makeQueryStringParametersSafe(event.queryStringParameters));

	let target = `${publicPath}/${rawPath}`;
	if (['/', '/routes'].includes(rawPath)) {
		target = `${publicPath}/index.html`;
	}
	target = path.resolve(target);

	if (fs.existsSync(target)) {
		const ext = target.match(/\.(\w+)$/)?.[1];

		let body = await fsPromises.readFile(target, { encoding: 'utf8' });
		let contentType = 'text/plain';

		switch (ext) {
			case 'html':
				contentType = 'text/html';
				break;
			case 'js':
				contentType = 'text/javascript';
				break;
			case 'css':
				contentType = 'text/css';
				break;
		}

		return {
			body,
			statusCode: 200,
			headers: { 'content-type': contentType }
		}
	}

	console.log('Failed to find target:', target);
	return {
		statusCode: 404
	}
}

module.exports = {
	handleContentRequest
};
