const { getAllVideoItems, getCustomArguments } = require('./common.js');

const customArgs = getCustomArguments({ accessToken: null,	commit: false });
if (typeof customArgs === 'string') {
	console.log(customArgs);
	return;
}
if (customArgs.commit && !customArgs.accessToken) {
	throw new Error(`accessToken is required`);
}

(async() => {
	const allPlateVideos = getAllVideoItems().filter(e => e.snippet.title.toUpperCase().includes('PLATE') && !e.snippet.title.includes('#'));
	const drafts = JSON.parse(JSON.stringify(allPlateVideos.filter(e => e.snippet.title.match(/^\d{4} \d{2} \d{2}/))));
	const projected = drafts.map(e => ({ id: e.id, title: e.snippet.title.replace(/\d{4} \d{2} \d{2} /g, ''), status: { privacyStatus: e.status.privacyStatus, publishAt: e.status.publishAt } }));

	if (customArgs.commit) {

	} else {
		console.log(JSON.stringify(projected, null, '\t'));
	}
})();