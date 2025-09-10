import fs from 'fs';
import path from 'path';
import child_process, { execSync } from 'child_process';
import { fileURLToPath } from 'url';

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputs = {
	commit: false,
	date: null,
	metaArchiveDir: path.resolve(__dirname, '../..', 'walk-routes/meta_archive'),
	walksDir: path.resolve('D:/wip/walks'),
	outputDir: path.resolve('D:/wip/walks/clips/output'),
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
	console.log(inputs);
	process.exit(0);
}

if (!inputs.date) {
	throw new Error(`date must be specified but was [${inputs.date}]`);
}

const [year, month, day] = inputs.date.split('-');

const expectedMetaFilePath = path.resolve(inputs.metaArchiveDir, year, month, day + '.json');
if (!fileDoesExist(expectedMetaFilePath)) {
	throw new Error(`Specified file [${expectedMetaFilePath}] does not exist`);
}

const expectedMergedFilePath = path.resolve(inputs.walksDir, `${year}-${month}-${day}`, `${year}-${month}-${day}_merged.mp4`);
if (!fileDoesExist(expectedMergedFilePath)) {
	throw new Error(`Specified file [${expectedMergedFilePath}] does not exist`);
}

const originalWalks = JSON.parse(fs.readFileSync(expectedMetaFilePath, 'utf8'));
if (originalWalks.length > 1) {
	throw new Error('Accounting for multiple walks in a single day is not yet implemented');
}

const outputFilePath = path.resolve(inputs.outputDir, `${year}-${month}-${day}_trimmed.mp4`);
if (fileDoesExist(outputFilePath)) {
	console.log(`Output file [${outputFilePath}] already exists, skipping ffmpeg`);
} else {
	const walk = originalWalks.at(0);
	const ffmpegArgs = [
		`-ss ${walk.startMark}`,
		`-to ${walk.endMark}`,
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