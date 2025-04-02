const fsPromises = require('fs/promises');

async function handleGitRequest() {
	const content = await fsPromises.readFile('./git.json', 'utf8');
	return {
		statusCode: 200,
		body: content,
		headers: {
			'content-type': 'application/json'
		}
	};
}

module.exports = {
	handleGitRequest
};
