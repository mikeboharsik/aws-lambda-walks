const { getAllVideoItems, getCustomArguments, shuffleArray } = require('./common.js');

const customArgs = getCustomArguments({ accessToken: null,	commit: false });
if (typeof customArgs === 'string') {
	console.log(customArgs);
	return;
}
if (customArgs.commit && !customArgs.accessToken) {
	throw new Error(`accessToken is required`);
}

(async() => {
	const allShorts = getAllVideoItems().filter(e => e.snippet.title.includes('#'));

	const relevantShorts = JSON.parse(JSON.stringify(allShorts
		.filter(e => e.status.publishAt && e.status.privacyStatus === 'private')
		.toSorted((a, b) => a.status.publishAt < b.status.publishAt ? -1 : 1)));

	const schedules = relevantShorts.map(e => e.status.publishAt);
	const shuffledSchedules = shuffleArray([...schedules], parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, '')));

	for (let [idx, item] of Object.entries(relevantShorts)) {
		item.status.publishAt = shuffledSchedules[idx];
	}

	relevantShorts.sort((a, b) => a.status.publishAt < b.status.publishAt ? -1 : 1);

	const url = `https://www.googleapis.com/youtube/v3/videos?part=id&part=status`;
	const headers = { Authorization: `Bearer ${customArgs.accessToken}` };
	const options = { method: 'PUT', headers };

	for (let [idx, item] of Object.entries(relevantShorts)) {
		const updateOptions = { ...options, body: JSON.stringify({ id: item.id, status: item.status }) };

		if (customArgs.commit) {
			const result = await fetch(url, updateOptions).then(r => r.json());
			console.log(`Successfully updated video ${Number(idx) + 1} of ${relevantShorts.length} [${item.id}] [${JSON.stringify(result)}]`);
		} else {
			const original = allShorts.find(e => e.id === item.id);
			console.log(`Video ${(Number(idx) + 1).toString().padStart(3)} of ${relevantShorts.length} --> [${item.id}]: [${original.status.publishAt}] => [${item.status.publishAt}]`);
		}
	}
})();
