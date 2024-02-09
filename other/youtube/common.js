const fs = require('fs');
const prando = require('prando')

function getCustomArguments(init = {}) {
	const keys = Object.keys(init);
	if (process.argv.length === 2 && keys.length) {
		let keysLog = keys.reduce((acc, cur) => { acc.push(`  - ${cur}`); return acc; }, []).join('\n');

		return `Arguments:\n${keysLog}`;
	}

	const customArgs = init;
	
	process.argv.forEach(e => {
		let [k, v] = e.split('=');
		
		if (k in customArgs) {
			if (v === 'true') v = true;
			
			customArgs[k] = v;
		}
	});

	return customArgs;
}

function getAllVideoItems() {
	return JSON.parse(fs.readFileSync('./uploads_videoitems.json')).flatMap(e => e.items);
}

function getAllDrafts() {
	return getAllVideoItems().filter(e => !e.status.publishAt && e.snippet.title.match(/\d{4} \d{2} \d{2}/));
}

function getAllDraftShortsWithoutPlates() {
	return getAllDrafts().filter(e => !e.snippet.title.match(/\d{4} \d{2} \d{2} Plate [A-Z]{2} /))
}

function getAllDraftShortsPlatesOnly() {
	return getAllDrafts().filter(e => e.snippet.title.match(/\d{4} \d{2} \d{2} Plate [A-Z]{2} /))
}

function shuffleArray(e, seed = 20240130) {
	const rng = new prando(seed);

	for (let i = e.length - 1; i > 0; i--) {
		const j = Math.floor(rng.next() * (i + 1));
		const temp = e[i];
		e[i] = e[j];
		e[j] = temp;
	}
	return e;
}

function getNextPublishedVideo() {
	return getAllVideoItems().reduce((acc, cur) => cur.status.publishAt < acc.status.publishAt ? cur : acc, { status: { publishAt: '3000-01-01' }});
}

function getLastPublishedVideo() {
	return getAllVideoItems().reduce((acc, cur) => cur.status.publishAt > acc.status.publishAt ? cur : acc, { status: { publishAt: '1970-01-01' }});
}

function getVideoDate(videoItem) {
	return videoItem.fileDetails.fileName.slice(0, 10);
}

module.exports = {
	getAllDrafts,
	getAllDraftShortsPlatesOnly,
	getAllDraftShortsWithoutPlates,
	getAllVideoItems,
	getCustomArguments,
	getLastPublishedVideo,
	getNextPublishedVideo,
	getVideoDate,
	shuffleArray,
};
