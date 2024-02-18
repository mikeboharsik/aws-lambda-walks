const { getAllMetaArchiveDocuments, getAllPublicVideoItems, getCustomArguments } = require('./common.js');

const customArgs = getCustomArguments({ accessToken: null,	commit: false });
if (typeof customArgs === 'string') {
	console.log(customArgs);
	return;
}
if (customArgs.commit && !customArgs.accessToken) {
	throw new Error(`accessToken is required`);
}

(async() => {
	const allWalkVideos = getAllPublicVideoItems().filter(e => e.snippet.title.match(/^\d{4}-\d{2}-\d{2} Walk - /));
	const videosWithoutChapters = allWalkVideos.filter(e => !e.snippet.description.match(/\d{2}:\d{2}:\d{2}/));

	var allMetaArchiveDocuments = getAllMetaArchiveDocuments();

	const projected = JSON.parse(JSON.stringify(videosWithoutChapters.map(e => ({
		description: e.snippet.description,
		id: e.id,
		title: e.snippet.title,
	}))));

	if (customArgs.commit) {

	} else {
		console.log(JSON.stringify(projected, null, '\t'));
	}
})();