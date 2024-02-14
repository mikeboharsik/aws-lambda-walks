const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const { getAllVideoItems, getAllDraftShortsWithoutPlates, getCustomArguments, shuffleArray } = require('./common.js');

const customArgs = getCustomArguments({ accessToken: null,	commit: false });
if (typeof customArgs === 'string') {
	console.log(customArgs);
	return;
}
if (customArgs.commit && !customArgs.accessToken) {
	throw new Error(`accessToken is required`);
}

const items = getAllVideoItems();
let lastScheduledDate = null;
let ytData = null;
let allRoutes = null;

async function getRouteId(date) {
	if (!ytData) {
		const ytDataUrl = `https://walks.mikeboharsik.com/api/yt-data`;
		ytData = await fetch(ytDataUrl).then(r => r.json());
	}
	
	const entry = ytData.data.find(e => e.date === date);
	if (!entry) {
		console.error(`Failed to find YT data for date [${date}]`);
		return null;
	}

	return entry.walks[0].routeId;
}

function getRoute(routeId) {
	let sourceFile = null;
	let route = null;
	for (let file in allRoutes) {
		sourceFile = file;
		route = allRoutes[file].find(e => e.properties.id === routeId);
		if (route) break;
	}
	if (!route) {
		throw new Error(`Failed to find route ID [${routeId}]`);
	}
	return route;
}

function getNextValidScheduleDate() {
	if (!lastScheduledDate) {
		for (const item of items) {
			if (item.status.publishAt && (!lastScheduledDate || item.status.publishAt > lastScheduledDate)) {
				lastScheduledDate = item.status.publishAt.slice(0, 10);
			}
		}
	}

	const d = new Date(lastScheduledDate);
	d.setDate(d.getDate() + 1);
	const nextValidScheduleDate = d.toISOString().slice(0, 10);
	lastScheduledDate = nextValidScheduleDate;

	return `${nextValidScheduleDate}T16:00:00Z`;
}

function getHashTagsFromRoute(route) {
	const hashTags = [];
	const knownStates = { 'fl': 'florida', 'ma': 'massachusetts', 'me': 'maine' };

	const [, stateShort] = route.properties.name.split('_');
	const stateFull = knownStates[stateShort.toLowerCase()];
	hashTags.push('#' + stateFull);
	
	hashTags.push(...route.properties.cities.map(e => '#' + e.toLowerCase()));

	return hashTags;
}

async function convertDraftToScheduled(draft) {
	const [, date, name] = draft.fileDetails.fileName.match(/^(\d{4}-\d{2}-\d{2})_(.*?)\./);
	
	const routeId = await getRouteId(date);
	if (!routeId) return null;

	const route = getRoute(routeId);

	const publishAt = getNextValidScheduleDate();

	const hashTags = ['#walk'];
	hashTags.unshift(...getHashTagsFromRoute(route));

	return {
		id: draft.id,
		snippet: {
			categoryId: '22',
			title: name.replace(/_/g, ' ') + ' ' + hashTags.join(' '),

			defaultLanguage: draft.snippet.defaultLanguage,
			description: draft.snippet.description,
			tags: [ ...draft.snippet.tags || [], date],
		},
		status: {
			privacyStatus: 'private',
			publishAt,

			embeddable: draft.status.embeddable,
			license: draft.status.license,
			privacyStatus: draft.status.privacyStatus,
			publicStatsViewable: draft.status.publicStatsViewable,
			selfDeclaredMadeForKids: draft.status.selfDeclaredMadeForKids
		}
	};
}

async function getAllRoutes() {
	const featuresDir = path.resolve('../../../walk-routes/features');
	
	const filenames = fs.readdirSync(featuresDir).filter(e => !e.toUpperCase().includes('COMMON')).map(e => `${featuresDir}\\${e}`);
	const routes = {};
	const jobs = [];
	for (const filename of filenames) {
		jobs.push((async () => JSON.parse(await fsp.readFile(filename)))());
	}
	
	const results = await Promise.all(jobs);
	for (let i = 0; i < filenames.length; i++) {
		const basename = path.basename(filenames[i]).replace('.json', '');
		routes[basename] = results[i];
	}

	return routes;
}

(async () => {
	allRoutes = await getAllRoutes();

	let [,, commit = false] = process.argv;
	commit = commit === 'true';

	const relevantItems = getAllDraftShortsWithoutPlates().map(e => ({
			id: e.id,
			fileDetails: {
				fileName: e.fileDetails.fileName,
			},
			snippet: {
				categoryId: e.snippet.categoryId,
				defaultLanguage: e.snippet.defaultLanguage,
				description: e.snippet.description,
				tags: e.snippet.tags,
				title: e.snippet.title,
			},
			status: {
				embeddable: e.status.embeddable,
				license: e.status.license,
				privacyStatus: e.status.privacyStatus,
				publishAt: e.status.publishAt,
				publicStatsViewable: e.status.publicStatsViewable,
				selfDeclaredMadeForKids: e.status.selfDeclaredMadeForKids
			}
		}));

	shuffleArray(relevantItems);

	const updatedItems = (await Promise.all(relevantItems.map(convertDraftToScheduled)))
		.filter(e => !!e)
		.sort((a, b) => a.status.publishAt < b.status.publishAt ? -1 : 1);

	const url = `https://www.googleapis.com/youtube/v3/videos?part=id&part=snippet&part=status`;
	const headers = { Authorization: `Bearer ${customArgs.accessToken}` };
	const options = { method: 'PUT', headers };

	try {
		for (const [idx, item] of Object.entries(updatedItems)) {
			const updateOptions = { ...options, body: JSON.stringify(item) };

			if (customArgs.commit) {
				const result = await fetch(url, updateOptions).then(r => r.json());
				console.log(`Successfully updated video ${Number(idx) + 1} of ${updatedItems.length} [${item.id}] [${JSON.stringify(result)}]`);
			} else {
				console.log(`Video ${Number(idx) + 1} of ${updatedItems.length}\n${JSON.stringify({
					id: item.id,
					title: `${relevantItems.find(e => e.id === item.id).snippet.title} --> ${item.snippet.title}`,
					publishAt: item.status.publishAt,
				})}`);
			}
		}
	} catch (e) {
		console.error(e);
	}
})();
