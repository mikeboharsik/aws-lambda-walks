import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getExifForDate(date) {
	const [year, month, day] = date.split('-');
	const expectedPath = path.resolve(__dirname, '../..', 'walk-routes', 'meta_archive', year, month, day + '.json');
	console.log(`Loading exif for date [${date}] from [${expectedPath}]`);
	const walksForDate = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
	if (walksForDate.length > 1) {
		throw new Error(`Date has ${walksForDate.length} walks, but this code currently only expects there to be one`);
	}
	return walksForDate[0].exif;
}

function getSectionsFromExif({ date, exif } = {}) {
	if (!date && !exif) {
		console.log('exif or date is required');
	}

	if (date) {
		exif = getExifForDate(date);
	}

	const startsAndEnds = exif.map(({ Duration, FileCreateDate, FileModifyDate, SourceFile }) => {
		const [chapter, idx] = SourceFile.match(/(GX)_(\d{4})_(\d{2})/).slice(2);
		const [hours, minutes, seconds] = Duration.split(':').map(e => parseInt(e));
		const duration = (hours * 60 * 60 * 1000) + (minutes * 60 * 1000) + (seconds * 1000);
		const start = new Date(FileCreateDate).getTime();
		const end = new Date(FileModifyDate).getTime();
		return {
			chapter,
			idx,
			duration,
			start,
			end,
		}
	});
	const groups = Object.groupBy(startsAndEnds, e => e.chapter);
	const sections = Object.entries(groups).reduce((acc, [chapter, clips]) => {
		let min = null;
		let max = null;
		let approximateDuration = 0;
		clips.forEach(clip => {
			if (min === null || min > clip.start) {
				min = clip.start;
			}
			if (max === null || max < clip.end) {
				max = clip.end;
			}
			approximateDuration += clip.duration;
		});
		acc.push({ chapter: parseInt(chapter), start: min, end: max, approximateDuration, calculatedDuration: max - min });
		return acc;
	}, []);
	return sections;
}

export default getSectionsFromExif;
