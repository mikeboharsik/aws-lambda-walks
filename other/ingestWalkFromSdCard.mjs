import { copyFile, mkdir, open, readdir, rename, readFile, rm, writeFile } from 'fs/promises';
import { createReadStream } from 'fs';
import { basename, dirname, resolve } from 'path';
import child_process from 'child_process';
import { createHash } from 'crypto';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const inputs = {
	keepOriginalFiles: false,
	metaArchiveDir: resolve(__dirname, '../..', 'walk-routes/meta_archive'),
	nasWalksDir: resolve('F:/wip/walks'),
	pathToMp4s: '/DCIM/100GOPRO',
	rootDrive: 'G:',
	walksDir: resolve('D:/wip/walks'),
};

const inputKeys = Object.keys(inputs);
process.argv.slice(2).forEach(keyval => {
	const [key, val] = keyval.split('=');
	if (inputKeys.includes(key)) {
		inputs[key] = val;
	}
});

const defaultFileNamePattern = /(G[XL])(\d{2})(\d{4})/;
const sensibleFileNamePatern = /G[XL]_\d{4}_\d{2}\.(MP4|LRV|THM)/;
const fileDatePattern = /(\d{4}):(\d{2}):(\d{2}) (\d{2}:\d{2}:\d{2})([+-]\d{2}:\d{2})*/;
const timePattern = /\d{1}:\d{2}:\d{2}/;
const secondsPattern = /(\d{1,2}) s/;

const fullPathToFiles = resolve(inputs.rootDrive, inputs.pathToMp4s);

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
		const { FileCreateDate, FileName, SourceFile } = exif;
		const date = new Date(FileCreateDate);
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
	const raw = child_process.execSync(`exiftool -api LargeFileSupport=1 ${videoPaths.join(' ')} -json`).toString();
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

function getMetaArchiveFilePathFromDate(date) {
	if (!date) throw new Error('date must have a value');
	const [year, month, day] = date.split('-');
	return resolve(inputs.metaArchiveDir, year, month, day + '.json');
}

function getOutputDir() {
	return resolve(inputs.walksDir);
}

function getOutputFilePathFromDate(date) {
	if (!date) throw new Error('date must have a value');
	return resolve(getOutputDir(date), `${date}_merged.mp4`);
}

function getNasFilePathFromDate(date) {
	if (!date) throw new Error('date must have a value');
	return resolve(inputs.nasWalksDir, `${date}_merged.mp4`);
}

async function createOutputDirIfNecessary(date) {
	if (!date) throw new Error('date must have a value');
	const walksDirs = await readdir(inputs.walksDir);
}

async function createMetaArchiveFileIfNecessary(date) {
	if (!date) throw new Error('date must have a value');
	const [year, month, day] = date.split('-');
	
	const rootDirs = await readdir(inputs.metaArchiveDir);
	if (!rootDirs.includes(year)) {
		const path = resolve(inputs.metaArchiveDir, year);
		await mkdir(path);
		console.log('Created directory', path);
	}

	const yearDirs = await readdir(resolve(inputs.metaArchiveDir, year));
	if (!yearDirs.includes(month)) {
		const path = resolve(inputs.metaArchiveDir, year, month);
		await mkdir(path);
		console.log('Created directory', path);
	}

	const monthFiles = await readdir(resolve(inputs.metaArchiveDir, year, month));
	const fileName = day + '.json';
	const filePath = resolve(inputs.metaArchiveDir, year, month, fileName);
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

	const from = `personalgdrive:/Walk Uploads/${date}_${idx+1}.json`;
	const to = resolve(expectedFilePath, '..');
	const command = `rclone copy "${from}" "${to}"`;
	console.log('Executing command', command);
	try {
		child_process.execSync(command);
	} catch (e) {
		throw new Error(`Failed to find walk upload for [${date}]`, e);
	}
	await rename(resolve(to, `${date}_${idx+1}.json`), resolve(to, expectedFilePath));
	const parsed = JSON.parse(await readFile(expectedFilePath, 'utf8'));
	await writeFile(expectedFilePath, JSON.stringify([parsed], null, 2), 'utf8');
}

function hasFileBeenCommitted(date) {
	if (!date) throw new Error('date must have a value');
	const cwd = inputs.metaArchiveDir;
	const formattedDate = date.replace(/-/g, '/');
	const command = `git --no-pager log --all --grep="add ${formattedDate}.json" --format=oneline`;
	console.log(`Executing command [${command}]`);
	const result = child_process.execSync(command, { cwd });
	const gitOutput = result.toString();
	return gitOutput.includes(formattedDate);
}

function commitWalkFile(date) {
	if (!date) throw new Error('date must have a value');

	const cwd = inputs.metaArchiveDir;

	if (hasFileBeenCommitted(date)) {
		console.warn(`File for date ${date} has already been committed to git; skipping`);
		return;
	}

	const formattedDate = date.replace(/-/g, '/');

	const stageCommand = `git add *${formattedDate}.json"`;
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

	if (inputs.keepOriginalFiles === 'true') {
		console.log('Leaving original files as-is');
		return;
	}

	console.log('Deleting files', allFiles);
	const jobs = allFiles.map(async (path) => await rm(resolve(fullPathToFiles, path)));
	await Promise.all(jobs);
	console.log('Deleted files');
}

function ejectSdCard() {
	try {
		const command = `(New-Object -ComObject Shell.Application).NameSpace(17).ParseName('${inputs.rootDrive}').InvokeVerb("Eject")`;
		child_process.execSync(command, { shell: 'pwsh' });
		child_process.execSync(command, { shell: 'pwsh' });
		console.log('Successfully ejected SD card');
	} catch (e) {
		console.error('Failed to eject SD card', e);
	}
}

const allFiles = await getAllFiles();
const videoFiles = allFiles.filter(e => e.match('.MP4'));
const videoPaths = videoFiles.map(e => resolve(fullPathToFiles, e));
const exifOutputs = getNormalizedExifOutputs(videoPaths);
const exifOutputsByDate = getExifOutputsByDate(exifOutputs);

for (const date of Object.keys(exifOutputsByDate)) {
	const exifsForDate = exifOutputsByDate[date];
	await getWalkUpload(date);
	await writeExifOutputs(exifsForDate, date);
	commitWalkFile(date);
	const videoPathsForDate = videoPaths.filter(vp => exifsForDate.some(ex => resolve(ex.SourceFile) === vp));
	await copyOriginalFilesToLocal(videoPathsForDate, date);
	await backupMergedFileToNas(date);
};

await deleteOriginalFiles(allFiles);
ejectSdCard();