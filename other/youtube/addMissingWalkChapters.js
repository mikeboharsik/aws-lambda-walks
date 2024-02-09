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
	const allWalkVideos = getAllVideoItems().filter(e => e.snippet.title.match(/^\d{4}-\d{2}-\d{2} Walk - /));
	const projected = allWalkVideos.map(e => ({
		description: e.snippet.description,
		id: e.id,
		title: e.snippet.title.replace(/\d{4} \d{2} \d{2} /g, ''),
	}));

	if (customArgs.commit) {

	} else {
		console.log(JSON.stringify(projected, null, '\t'));
	}
})();