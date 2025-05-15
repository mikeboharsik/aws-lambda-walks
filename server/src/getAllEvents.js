const fsPromises = require('fs/promises');
const { getBenchmarkedFunctionAsync } = require('./getBenchmarkedFunction.js');

async function getAllEvents(event) {
	const content = await fsPromises.readFile(`${process.env.GENERATED_PATH || '.'}/events/all.json`);
	return JSON.parse(content);
}
const getAllEventsBenched = getBenchmarkedFunctionAsync(getAllEvents);

module.exports = {
	getAllEvents: getAllEventsBenched,
};