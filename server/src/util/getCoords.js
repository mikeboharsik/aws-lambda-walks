const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');

const geolib = require('geolib');

const { getBenchmarkedFunctionAsync } = require('./getBenchmarkedFunction.js');
const getGeneratedPath = require('./getGeneratedPath.js');

async function getCoordsByMonth(event, month) {
	try {
		const resolvedPath = path.resolve(`${getGeneratedPath()}/coords/${month}.json`);
		return JSON.parse(await fsPromises.readFile(resolvedPath));
	} catch (e) {
		throw new Error(`Failed to load data for month ${month}`);
	}
}
const getCoordsByMonthBenched = getBenchmarkedFunctionAsync(getCoordsByMonth);

async function getAllCoords(event) {
	const coordsPath = `${getGeneratedPath()}/coords`;
	const monthFiles = fs.readdirSync(coordsPath);
	const jobs = monthFiles.map(async (file) => {
		const resolvedPath = path.resolve(coordsPath + '/' + file);
		return JSON.parse(fs.readFileSync(resolvedPath), 'utf8')
	});
	const allCoords = await Promise.all(jobs);
	return allCoords;
}
const getAllCoordsBenched = getBenchmarkedFunctionAsync(getAllCoords);

async function getCoordsNearPoint(event) {
	let { queryStringParameters: { nearPoint, nearPointRadius = 20 } = {} } = event;
	nearPoint = nearPoint.split(',').map(e => parseFloat(e.trim()));
	const [targetLat, targetLon] = nearPoint;

	const coordsPath = `${getGeneratedPath()}/coords`;
	const monthFiles = fs.readdirSync(coordsPath);
	const jobs = monthFiles.map(async (file) => {
		const resolvedPath = path.resolve(coordsPath + '/' + file);
		const dayEntries = JSON.parse(fs.readFileSync(resolvedPath), 'utf8');
		const hits = [];
		dayEntries.forEach(dayEntry => {
			if (dayEntry.bounds) {
				const { bounds: { minLat, minLng, maxLat, maxLng } } = dayEntry;
				const dayBoundingBox = [
					{ latitude: minLat, longitude: minLng },
					{ latitude: minLat, longitude: maxLng },
					{ latitude: maxLat, longitude: maxLng },
					{ latitude: maxLat, longitude: minLng },
					{ latitude: minLat, longitude: minLng },
				];
				if (!geolib.isPointInPolygon({ latitude: targetLat, longitude: targetLon }, dayBoundingBox)) {
					return null;
				}

				for (const [lat, lon] of (dayEntry?.coords || [])) {
					const isHit = geolib.isPointWithinRadius(
						{ latitude: lat, longitude: lon },
						{ latitude: targetLat, longitude: targetLon },
						nearPointRadius,
					);
					if (isHit) {
						return hits.push(dayEntry);
					}
				}
			}
		});
		return hits;
	});
	const coordsNearPoint = await Promise.all(jobs);
	const coordsFlattened = coordsNearPoint.flatMap(e => e);
	return coordsFlattened;
}
const getCoordsNearPointBenched = getBenchmarkedFunctionAsync(getCoordsNearPoint);


module.exports = {
	getAllCoords: getAllCoordsBenched,
	getCoordsNearPoint: getCoordsNearPointBenched,
	getCoordsByMonth: getCoordsByMonthBenched,
};
