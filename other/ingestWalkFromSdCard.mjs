import { copyFile, mkdir, open, readdir, rename, readFile, rm, writeFile } from 'fs/promises';
import { createReadStream, readdirSync } from 'fs';
import { basename, dirname, join, resolve } from 'path';
import child_process from 'child_process';
import { createHash } from 'crypto';
import { getVideoDurationInSeconds } from 'get-video-duration';

import 'dotenv/config';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_KEYS = {
	EXIF_TOOL_PATH: 'EXIF_TOOL_PATH',
	RCLONE_PATH: 'RCLONE_PATH',
	RCLONE_REMOTE_NAME: 'RCLONE_REMOTE_NAME',
	KEEP_ORIGINAL_FILES: 'KEEP_ORIGINAL_FILES',
	META_ARCHIVE_DIR: 'META_ARCHIVE_DIR',
	NAS_WALKS_DIR: 'NAS_WALKS_DIR',
	PATH_TO_MP4S: 'PATH_TO_MP4S',
	ROOT_DRIVE: 'ROOT_DRIVE',
	SKIP_BACKUP: 'SKIP_BACKUP',
	WALKS_DIR: 'WALKS_DIR',
};

function getConfig(key) {
	return process.env[key];
}

function getExifToolPath() {
	return getConfig(CONFIG_KEYS.EXIF_TOOL_PATH) || 'exiftool';
}

function getRclonePath() {
	return getConfig(CONFIG_KEYS.RCLONE_PATH) || 'rclone';
}

function getRcloneRemoteName() {
	return getConfig(CONFIG_KEYS.RCLONE_REMOTE_NAME) || 'personalgdrive';
}

function getSkipBackup() {
	return getConfig(CONFIG_KEYS.SKIP_BACKUP) === 'true';
}

function getKeepOriginalFiles() {
	return getConfig(CONFIG_KEYS.KEEP_ORIGINAL_FILES) === 'true';
}

function validateEnvironment() {
	const successes = [];

	function run(command, name) {
		try { child_process.execSync(command, { stdio: 'ignore' }); successes.push({ [name]: true }) }
		catch { successes.push({ [name]: false }); }
	}

	run(getExifToolPath(), 'exiftool');
	run(getRclonePath() + ' version', 'exiftool');

	const failures = successes.filter(e => !Object.values(e).every(v => v === true))
	if (failures.length) {
		throw new Error(`Failed to validate [${failures}]`);
	}
}

console.log(Object.keys(CONFIG_KEYS).reduce((acc, key) => { acc['process.env.' + key] = process.env[key]; return acc; }, {}));

validateEnvironment();

const defaultFileNamePattern = /(G[XL])(\d{2})(\d{4})/;
const sensibleFileNamePatern = /G[XL]_\d{4}_\d{2}\.(MP4|LRV|THM)/;
const fileDatePattern = /(\d{4}):(\d{2}):(\d{2}) (\d{2}:\d{2}:\d{2})([+-]\d{2}:\d{2})*/;
const timePattern = /\d{1}:\d{2}:\d{2}/;
const secondsPattern = /(\d{1,2}) s/;

const fullPathToFiles = resolve(join(getConfig(CONFIG_KEYS.ROOT_DRIVE), getConfig(CONFIG_KEYS.PATH_TO_MP4S)));

async function fileDoesExist(fullPath) {
	try {
		const fh = await open(fullPath);
		fh.close();
		return true;
	} catch {}

	return false;
}

function defaultToGoodFileName(defaultFileName) {
	if (!defaultFileName.match(defaultFileNamePattern)) {
		if (defaultFileName.match(sensibleFileNamePatern)) {
			console.warn(`[${defaultFileName}] was already renamed, skipping`);
		} else {
			console.warn(`Provided value [${defaultFileName}] is not a valid default GoPro file name, skipping`);
		}
		return defaultFileName;
	}
	return defaultFileName.replace(/(G[XL])(\d{2})(\d{4})/, '$1_$3_$2');
}

async function renameDefaultFiles(defaultFileNames) {
	if (!defaultFileNames) throw new Error('defaultFileNames must have a value');
	const newFiles = defaultFileNames.map(async (defaultFileName) => {
		const newName = defaultToGoodFileName(defaultFileName);
		if (newName === defaultFileName) {
			return newName;
		}
		const oldPath = defaultFileName;
		const newPath = newName;
		await rename(resolve(fullPathToFiles, oldPath), resolve(fullPathToFiles, newPath));
		return newName;
	});
	return await Promise.all(newFiles);
}

async function getAllFiles() {
	const files = await readdir(fullPathToFiles);
	if (!files.length) throw new Error('No files to process');
	return await renameDefaultFiles(files);
}

function getExifOutputsByDate(exifOutputs) {
	if (!exifOutputs) throw new Error('exifOutputs must have a value');
	return exifOutputs.reduce((acc, exif) => {
		const { CreationDate, FileCreateDate } = exif;
		const date = new Date(FileCreateDate || CreationDate);
		const yyyyMMdd = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
		if (yyyyMMdd in acc) {
			acc[yyyyMMdd].push(exif);
		} else {
			acc[yyyyMMdd] = [exif];
		}
		return acc;
	}, {});
}

function getNormalizedExifOutputs(videoPaths) {
	if (!videoPaths) throw new Error('videoPaths must have a value');
	const properties = [
		'AudioBitsPerSample',
		'AudioSampleRate',
		'BitDepth',
		'CreationDate',
		'FileCreateDate',
		'ImageSize',
		'SourceFile',
		'VideoFrameRate'
	].map(e => '-' + e).join(' ');
	const exifToolPath = getExifToolPath();
	const exifToolCommand = `${exifToolPath} -api LargeFileSupport=1 ${properties} ${videoPaths.join(' ')} -json`;
	console.log(`Running exiftool command [${exifToolCommand}]`);
	const raw = child_process.execSync(exifToolCommand).toString();
	const parsed = JSON.parse(raw);
	parsed.forEach(entry => {
		Object.entries(entry).forEach(([k, v]) => {
			const fileDateMatch = v?.match?.(fileDatePattern);
			if (fileDateMatch) {
				const [year, month, day, time, zone] = fileDateMatch.slice(1);
				entry[k] = `${year}-${month}-${day}T${time}${zone || ''}`;
				return;
			}

			const timeMatch = v?.match?.(timePattern);
			if (timeMatch) {
				entry[k] = '0' + v;
				return;
			}

			const secondsMatch = v?.match?.(secondsPattern);
			if (secondsMatch) {
				const [seconds] = secondsMatch.slice(1);
				entry[k] = '00:00:' + seconds.padStart(2, '0');
				return;
			}
		});
	});
	return parsed;
}

async function getVideoDurations(videoPaths) {
	const jobs = videoPaths.map((path) => {
		return (async () => {
			const duration = await getVideoDurationInSeconds(path).then(dur => Math.round(dur * 1000));
			return { path: path.replace(/\\/g, '/'), duration };
		})();
	});

	return await Promise.all(jobs);
}

function mergeVideoDurationsIntoExifByDate(exifByDate, videoDurations) {
	const dates = Object.keys(exifByDate);
	dates.forEach(date => {
		const exifForDate = exifByDate[date];
		exifForDate.forEach(exif => {
			videoDurations.forEach(videoDuration => {
				if (exif.SourceFile === videoDuration.path) {
					exif.DurationMs = videoDuration.duration;
				}
			});
		});
	});
}

function getMetaArchiveFilePathFromDate(date) {
	if (!date) throw new Error('date must have a value');
	const [year, month, day] = date.split('-');
	return resolve(getConfig(CONFIG_KEYS.META_ARCHIVE_DIR), year, month, day + '.json');
}

function getOutputDir() {
	return resolve(getConfig(CONFIG_KEYS.WALKS_DIR));
}

function getOutputFilePathFromDate(date) {
	if (!date) throw new Error('date must have a value');
	return resolve(getOutputDir(date), `${date}_merged.mp4`);
}

function getNasFilePathFromDate(date) {
	if (!date) throw new Error('date must have a value');
	return resolve(getConfig(CONFIG_KEYS.NAS_WALKS_DIR), `${date}_merged.mp4`);
}

async function createOutputDirIfNecessary(date) {
	if (!date) throw new Error('date must have a value');
	await readdir(getConfig(CONFIG_KEYS.WALKS_DIR));
}

async function createMetaArchiveFileIfNecessary(date) {
	if (!date) throw new Error('date must have a value');
	const [year, month, day] = date.split('-');

	const metaArchiveDir = getConfig(CONFIG_KEYS.META_ARCHIVE_DIR);
	
	const rootDirs = await readdir(metaArchiveDir);
	if (!rootDirs.includes(year)) {
		const path = resolve(metaArchiveDir, year);
		await mkdir(path);
		console.log('Created directory', path);
	}

	const yearDirs = await readdir(resolve(metaArchiveDir, year));
	if (!yearDirs.includes(month)) {
		const path = resolve(metaArchiveDir, year, month);
		await mkdir(path);
		console.log('Created directory', path);
	}

	const monthFiles = await readdir(resolve(metaArchiveDir, year, month));
	const fileName = day + '.json';
	const filePath = resolve(metaArchiveDir, year, month, fileName);
	if (!monthFiles.includes(fileName)) {
		await writeFile(filePath, JSON.stringify([{ date }], null, 2), 'utf8');
		console.log('Created file', filePath);
	}
}

async function writeExifOutputs(exifOutputs, date) {
	if (!exifOutputs) throw new Error('exifOutputs must have a value');
	if (!date) throw new Error('date must have a value');
	await createMetaArchiveFileIfNecessary(date);

	const filePath = getMetaArchiveFilePathFromDate(date);
	const parsed = JSON.parse(await readFile(filePath, 'utf8'));
	if (parsed.length > 1) {
		console.warn('File contains more than one walk, cannot determine which to update; skipping');
		return;
	}

	if (!parsed.length) {
		parsed.push({ date });
	}
	const walk = parsed[0];
	if (walk.exif) {
		console.warn('exif is already defined; skipping');
		return;
	}

	walk.exif = exifOutputs;

	await writeFile(filePath, JSON.stringify(parsed, null, 2), 'utf8');
	console.log('Wrote exifOutputs to', filePath);
}

async function getWalkUpload(date, idx = 0) {
	if (!date) throw new Error('date must have a value');

	const expectedFilePath = getMetaArchiveFilePathFromDate(date);
	if (await fileDoesExist(expectedFilePath)) {
		console.warn(`Already created a file for ${date}, skipping`);
		return;
	}

	const rcloneRemoteName = getRcloneRemoteName();
	const from = `${rcloneRemoteName}:/Walk Uploads/${date}_${idx+1}.json`;
	const to = resolve(expectedFilePath, '..');
	const rclonePath = getRclonePath();
	const command = `${rclonePath} copy "${from}" "${to}"`;
	console.log('Executing command', command);
	try {
		child_process.execSync(command);
	} catch (e) {
		throw new Error(`Failed to find walk upload for [${date}]`, e);
	}
	await rename(resolve(to, `${date}_${idx+1}.json`), resolve(join(to, expectedFilePath)));
	const parsed = JSON.parse(await readFile(expectedFilePath, 'utf8'));
	await writeFile(expectedFilePath, JSON.stringify([parsed], null, 2), 'utf8');
}

function hasFileBeenCommitted(date) {
	if (!date) throw new Error('date must have a value');
	const cwd = getConfig(CONFIG_KEYS.META_ARCHIVE_DIR);
	const formattedDate = date.replace(/-/g, '/');
	const command = `git --no-pager log --all --grep="add ${formattedDate}.json" --format=oneline`;
	console.log(`Executing command [${command}]`);
	const result = child_process.execSync(command, { cwd });
	const gitOutput = result.toString();
	return gitOutput.includes(formattedDate);
}

function commitWalkFile(date) {
	if (!date) throw new Error('date must have a value');

	const cwd = getConfig(CONFIG_KEYS.META_ARCHIVE_DIR);

	if (hasFileBeenCommitted(date)) {
		console.warn(`File for date ${date} has already been committed to git; skipping`);
		return;
	}

	const formattedDate = date.replace(/-/g, '/');

	const stageCommand = `git add *${formattedDate}.json`;
	child_process.execSync(stageCommand, { cwd });

	const commitMessage = `feat: add ${formattedDate}.json to meta_archive`;
	const commitCommand = `git commit -m "${commitMessage}"`;
	child_process.execSync(commitCommand, { cwd });

	const pushCommand = `git push`;
	child_process.execSync(pushCommand, { cwd });

	console.log(`Pushed new commit with message [${commitMessage}]`);
}

async function getFileHash(fullPath) {
	if (!fullPath) throw new Error('fullPath must have a value');

	return new Promise((resolve, reject) => {
		// the file you want to get the hash    
		var fd = createReadStream(fullPath);
		var hash = createHash('sha1');
		hash.setEncoding('hex');

		fd.on('end', function() {
				hash.end();
				resolve(hash.read()); // the desired sha1sum
		});

		// read all file and pipe it (write it) to the hash object
		fd.pipe(hash);
	});
}

async function copyOriginalFilesToLocal(videoPaths, date) {
	if (!videoPaths) throw new Error('videoPaths must have a value');
	if (!date) throw new Error('date must have a value');

	await createOutputDirIfNecessary(date);
	const outputDir = getOutputDir(date);
	
	const outputFilePath = resolve(outputDir, `${date}_merged.mp4`);
	if (await fileDoesExist(outputFilePath)) {
		console.warn(outputFilePath, 'already exists; skipping');
		return;
	}

	const filesContent = videoPaths.reduce((acc, cur) => {
		return acc + `file ${basename(cur)}\n`;
	}, '');
	const filesTxtPath = resolve(fullPathToFiles, 'files.txt');

	await writeFile(filesTxtPath, filesContent, 'utf8');

	const command = `ffmpeg -f concat -i ${filesTxtPath} -c copy ${outputFilePath}`;
	console.log('Executing command', command);
	const result = child_process.execSync(command);
	console.log('Output from ffmpeg:', result.toString());

	await rm(filesTxtPath);
}

async function backupMergedFileToNas(date) {
	if (!date) throw new Error('date must have a value');

	const localFilePath = getOutputFilePathFromDate(date);
	const nasFilePath = getNasFilePathFromDate(date);
	if (await fileDoesExist(localFilePath)) {
		if (await fileDoesExist(nasFilePath)) {
			console.warn(`Tried to backup [${localFilePath}] to [${nasFilePath}] but the destination file already exists; skipping`);
			return;
		}
		console.log(`Backing up [${localFilePath}] to [${nasFilePath}]`);
		await copyFile(localFilePath, nasFilePath);
		return;
	}

	throw new Error(`Tried to find [${localFilePath}] for backup to NAS but it does not exist`);
}

async function deleteOriginalFiles(allFiles) {
	if (!allFiles) throw new Error('allFiles must have a value');

	if (getSkipBackup() || getKeepOriginalFiles()) {
		console.log('Leaving original files as-is. If you wish to delete the original files, do so manually.');
		return;
	}

	console.log('Deleting files', allFiles);
	const jobs = allFiles.map(async (path) => await rm(resolve(fullPathToFiles, path)));
	await Promise.all(jobs);
	console.log('Deleted files');
}

function ejectSdCard() {
	if (process.platform === 'linux') {
		const command = 'udisksctl unmount -b /dev/mmcblk0p1';
		child_process.execSync(command);
	}
	else {
		const rootDrive = getConfig(CONFIG_KEYS.ROOT_DRIVE);

		try {		
			const command = `(New-Object -ComObject Shell.Application).NameSpace(17).ParseName('${rootDrive}').InvokeVerb("Eject")`;
			child_process.execSync(command, { shell: 'pwsh' });
			try {
				readdirSync(rootDrive);
				child_process.execSync(command, { shell: 'pwsh' });
			} catch (e) {}
			console.log('Successfully ejected SD card');
		} catch (e) {
			console.error('Failed to eject SD card', e);
		}
	}
}

const allFiles = await getAllFiles();
const videoFiles = allFiles.filter(e => e.match('.MP4'));
const videoPaths = videoFiles.map(e => resolve(fullPathToFiles, e));
const exifOutputs = getNormalizedExifOutputs(videoPaths);
const exifOutputsByDate = getExifOutputsByDate(exifOutputs);
const videoDurations = await getVideoDurations(videoPaths);
mergeVideoDurationsIntoExifByDate(exifOutputsByDate, videoDurations);

const dates = Object.keys(exifOutputsByDate);
const garbage = dates.filter(date => date.includes('NaN'));
if (garbage.length) {
	throw new Error(`Failed to parse date for at least one of the groups of video files [${garbage.join(', ')}]`);
}

console.log(`Found videos for the following dates: [${dates.join(', ')}]`);

for (const date of dates) {
	const exifsForDate = exifOutputsByDate[date];
	await getWalkUpload(date);
	await writeExifOutputs(exifsForDate, date);
	commitWalkFile(date);
	const videoPathsForDate = videoPaths.filter(vp => exifsForDate.some(ex => resolve(ex.SourceFile) === vp));
	await copyOriginalFilesToLocal(videoPathsForDate, date);

	if (getConfig(CONFIG_KEYS.SKIP_BACKUP) !==  'true') {
		await backupMergedFileToNas(date);
	}
};

await deleteOriginalFiles(allFiles);
ejectSdCard();
