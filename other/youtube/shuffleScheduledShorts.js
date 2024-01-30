const { getAllVideoItems, getCustomArguments, shuffleArray } = require('./common.js');

const customArgs = getCustomArguments({ accessToken: null,	commit: false });
if (typeof customArgs === 'string') {
	console.log(customArgs);
	return;
}
if (customArgs.commit && !customArgs.accessToken) {
	throw new Error(`accessToken is required`);
}

const items = getAllVideoItems();

const relevantItems = items.filter(e => e.status.publishAt && e.status.privacyStatus === 'private');

const schedules = relevantItems.map(e => e.status.publishAt);
const shuffledSchedules = shuffleArray([...schedules]);

for (let [idx, item] of Object.entries(relevantItems)) {
	item.status.publishAt += ` -> ${shuffledSchedules[idx]}`;
}

console.log(relevantItems);//.map(e => ({ id: e.id, status: e.status })));
