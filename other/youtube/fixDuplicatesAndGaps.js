const fs = require('fs/promises');

const { getAllVideoItems, getCustomArguments, getLastPublishedVideo, getNextPublishedVideo } = require('./common.js');

const customArgs = getCustomArguments({ accessToken: null,	commit: false });
if (typeof customArgs === 'string') {
	console.log(customArgs);
	return;
}
if (customArgs.commit && !customArgs.accessToken) {
	throw new Error(`accessToken is required`);
}

(async() => {
	const nextVid = getNextPublishedVideo();
	const lastVid = getLastPublishedVideo();

	const pendingDates = [];
	const [nextYear, nextMonth, nextDay] = nextVid.status.publishAt.slice(0, 10).split('-');
	const [lastYear, lastMonth, lastDay] = lastVid.status.publishAt.slice(0, 10).split('-');
	const firstDate = new Date(nextYear, parseInt(nextMonth) - 1, nextDay);
	const lastDate = new Date(lastYear, parseInt(lastMonth) - 1, lastDay);
	while (firstDate <= lastDate) {
		pendingDates.push({ date: firstDate.toISOString().slice(0, 10), videos: [] });
		firstDate.setDate(firstDate.getDate() + 1);
	}

	const allScheduledVideos = getAllVideoItems().filter(e => e.status.publishAt);
	allScheduledVideos.forEach((e) => {
		const date = e.status.publishAt.slice(0, 10);
		let pendingDate = pendingDates.find(e => e.date === date);
		if (pendingDate) {
			pendingDate.videos.push({ id: e.id, title: e.snippet.title });
		} else {
			console.log(JSON.stringify(pendingDates));
			throw new Error('Failed to find pendingDate for ' + date);
		}
	});

	const duplicates = pendingDates.toSorted((a, b) => a.date < b.date ? -1 : 1).filter(e => e.videos.length > 1);
	const gaps = pendingDates.toSorted((a, b) => a.date < b.date ? -1 : 1).filter(e => !e.videos.length);
	console.log({ duplicates: duplicates.map(e => e.date), gaps: gaps.map(e => e.date) });
})();
