import fs from 'fs';
import path from 'path';
import child_process, { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { saveScreenshot } from './thumbnail/getMapScreenshot.js';
import getSectionsFromExif from './getSectionsFromExif.mjs';

function fileDoesExist(path) {
	try {
		const fd = fs.openSync(path);
		fs.closeSync(fd);
		return true;
	} catch {
		return false;
	}
}

function timespanToMilliseconds(timespan) {
	const [hours, minutes, seconds, milliseconds] = timespan.match(/(\d{2}):(\d{2}):(\d{2})\.*(\d{3})*/).slice(1).map(e => parseInt(e ?? 0));
	return (hours * 60 * 60 * 1000) + (minutes * 60 * 1000) + (seconds * 1000) + milliseconds;
}

function millisecondsToTimespan(ms) {
	const totalHours = ms / 1000 / 60 / 60;
	const hours = Math.floor(totalHours).toString().padStart(2, '0');
	const totalMinutes = ms / 1000 / 60;
	const minutes = (Math.floor(totalMinutes) % 60).toString().padStart(2, '0');
	const seconds = (Math.floor(ms / 1000) % 60).toString().padStart(2, '0');
	const milliseconds = (ms % 1000).toString().padStart(3, '0');
	return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

async function getCoordinateData(lat, lon) {
	return fetch(`http://127.0.0.1:8080/reverse.php?lat=${lat}&lon=${lon}&zoom=18&layer=address&format=jsonv2`)
		.then(r => r.json())
		.then(r => ({
			city: r.address.city,
			state: r.address['ISO3166-2-lvl4'].replace('US-', ''),
			town: r.address.town,
		}));
}

async function getStatesAndTownsForWalk(walk) {
	const coordJobs = walk.coords.reduce((acc, cur, idx) => {
		if (idx % 10 === 0) {
			acc.push(getCoordinateData(cur.lat, cur.lon));
		}
		return acc;
	}, []);
	const points = await Promise.all(coordJobs);
	const statesAndTowns = points.reduce((acc, { city, state, town }) => {
		const cityOrTown = town || city;
		if (acc[state]) {
			if (!acc[state].includes(cityOrTown)) {
				acc[state].push(cityOrTown);
			}
		} else {
			acc[state] = [town];
		}
		return acc;
	}, {});
	return statesAndTowns;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputs = {
	commit: false,
	date: null,
	forceThumbnail: false,
	metaArchiveDir: path.resolve(__dirname, '../..', 'walk-routes/meta_archive'),
	thumbnailDir: path.resolve(__dirname, 'thumbnail'),
	thumbnailZoom: null,
	outputDir: path.resolve('D:/wip/walks'),
	videos: null,
	walksDir: path.resolve('D:/wip/walks'),
	ss: null,
	to: null,
	skipGit: false,
};

const inputKeys = Object.keys(inputs);
let argWasProvided = false;
process.argv.slice(2).forEach(keyval => {
	const [key, val] = keyval.split('=');
	if (inputKeys.includes(key)) {
		inputs[key] = val;
		argWasProvided |= true;
	}
});

if (!argWasProvided) {
	console.log(inputKeys);
	process.exit(0);
}

if (!inputs.date) {
	const now = new Date();
	inputs.date = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
}
if (inputs.videos) {
	inputs.videos = JSON.parse(inputs.videos);
}
console.log(JSON.stringify(inputs, null, 2));

const [year, month, day] = inputs.date.split('-');

const expectedMetaFilePath = path.resolve(inputs.metaArchiveDir, year, month, day + '.json');
if (!fileDoesExist(expectedMetaFilePath)) {
	throw new Error(`Specified file [${expectedMetaFilePath}] does not exist`);
}

const expectedMergedFilePath = path.resolve(inputs.walksDir, `${year}-${month}-${day}_merged.mp4`);
if (!fileDoesExist(expectedMergedFilePath)) {
	throw new Error(`Specified file [${expectedMergedFilePath}] does not exist`);
}

const originalWalks = JSON.parse(fs.readFileSync(expectedMetaFilePath, 'utf8'));
if (originalWalks.length > 1) {
	throw new Error('Accounting for multiple walks in a single day is not yet implemented');
}
const walk = originalWalks.at(0);

const outputFilePath = path.resolve(inputs.outputDir, `${year}-${month}-${day}_trimmed.mp4`);
if (fileDoesExist(outputFilePath)) {
	console.log(`Output file [${outputFilePath}] already exists, skipping ffmpeg`);
} else {
	const sections = getSectionsFromExif({ exif: walk.exif });
	walk.sections = sections;
	const gapMs = sections.reduce((acc, section, idx, arr) => {
		if (idx < arr.length - 1) {
			return acc + (arr[idx + 1].start - section.end);
		}
		return acc;
	}, 0);
	const calculatedEnd = millisecondsToTimespan(walk.endMark - gapMs);

	const ffmpegArgs = [
		`-ss ${inputs.ss || millisecondsToTimespan(walk.startMark)}`,
		`-to ${inputs.to || calculatedEnd}`,
		`-i ${expectedMergedFilePath}`,
		'-c copy',
		outputFilePath,
	];

	if (inputs.commit === 'true') {
		child_process.execSync(`ffmpeg ${ffmpegArgs.join(' ')}`);
	} else {
		console.log({ ffmpegArgs });
	}
}

if (inputs.ss) {
	walk.startMark = timespanToMilliseconds(inputs.ss);
	console.log(`Set walk.startMark to [${walk.startMark}]`);
}

if (inputs.to) {
	walk.endMark = timespanToMilliseconds(inputs.to);
	console.log(`Set walk.endMark to [${walk.endMark}]`);
}

getStatesAndTownsForWalk(walk)
	.then(statesAndTowns => {
		let didUpdateWalk = false;

		if (walk.towns) {
			console.log(`Towns have already been calculated for [${inputs.date}], skipping`);
		} else {
			if (inputs.commit) {
				walk.towns = statesAndTowns;
				didUpdateWalk |= true;
			} else {
				console.log('walk.towns =', JSON.stringify(statesAndTowns));
			}
		}

		if (walk.videos) {
			console.log(`Videos have already been populated for [${inputs.date}], skipping`);
		} else {
			if (inputs.commit) {
				walk.videos = inputs.videos;
				didUpdateWalk |= true;
			} else {
				console.log('walk.videos =', JSON.stringify(inputs.videos));
				Object.keys(inputs.videos).forEach((videoId) => {
					fetch(`https://www.youtube.com/watch?v=${videoId}`)
						.then(r => r.text())
						.then(r => {
							const matches = r.match(/<meta property="og:title" content="(.*?)">/);
							if (matches) {
								console.log(`[${videoId}] title is [${matches[1]}]`);
							} else {
								console.log(`Failed to find title for ${videoId}`);
							}
						});
				});
			}
		}

		const cwd = inputs.metaArchiveDir;
		const dateReplaced = inputs.date.replace(/-/g, '/');
		const stageCommand = `git add *${dateReplaced}.json`;
		const commitCommand = `git commit -m "feat: add sections, towns, and videos to ${dateReplaced}.json"`;

		if (!inputs.commit || inputs.skipGit) {
			console.log(`Would run command [${stageCommand}]`);
			console.log(`Would run command [${commitCommand}]`);
		}

		if (didUpdateWalk && !inputs.skipGit) {
			fs.writeFileSync(expectedMetaFilePath, JSON.stringify(originalWalks, null, 2), 'utf8');

			child_process.execSync(stageCommand, { cwd });
			console.log(`Ran command [${stageCommand}]`);

			child_process.execSync(commitCommand, { cwd });
			console.log(`Ran command [${commitCommand}]`);

			child_process.execSync('Backup-Repos -RepoNames walk-routes', { shell: 'pwsh' }).toString();
			console.log('Backed up walk-routes repo');
		}

		const expectedThumbnailPath = path.resolve(inputs.outputDir, `${inputs.date}_0_thumbnail.jpeg`);
		if (fileDoesExist(expectedThumbnailPath) && !inputs.forceThumbnail) {
			console.log(`Thumbnail has already been generated at [${expectedThumbnailPath}], skipping`);
		} else {
			if (inputs.commit || inputs.forceThumbnail) {
				saveScreenshot(inputs.date, 0, inputs.forceThumbnail && parseFloat(inputs.thumbnailZoom));
			}
		}
	});