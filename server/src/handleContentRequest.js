const fs = require('fs');
const fsPromises = require('fs/promises');

const { makeQueryStringParametersSafe } = require('./makeQueryStringParametersSafe.js');

async function handleContentRequest(event) {
	const { isAuthed, rawPath } = event;

	console.log('handle content request', rawPath, makeQueryStringParametersSafe(event.queryStringParameters));

	let target = `./public/${rawPath}`;
	if (['/', '/oauth', '/routes'].includes(rawPath)) {
		target = './public/index.html';
	}

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

	return {
		statusCode: 404
	}
}

module.exports = {
	handleContentRequest
};
