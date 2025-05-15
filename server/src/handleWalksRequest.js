const { getWalksByMonth } = require('./getWalksByMonth.js');

async function handleWalksRequest(event) {
	try {
		return await getWalksByMonth(event);
	} catch (e) {
		console.error(e);
		return {
			statusCode: 400
		};
	}
}

module.exports = {
	handleWalksRequest
};
