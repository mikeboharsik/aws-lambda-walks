const { getAllDraftShortsPlatesOnly, getCustomArguments } = require('./common.js');

const customArgs = getCustomArguments({ accessToken: null,	commit: false });
if (typeof customArgs === 'string') {
	console.log(customArgs);
	return;
}
if (customArgs.commit && !customArgs.accessToken) {
	throw new Error(`accessToken is required`);
}

(async() => {
	const drafts = getAllDraftShortsPlatesOnly();
	const projected = drafts.map(e => ({ id: e.id, snippet: { ...e.snippet, title: e.snippet.title.replace(/\d{4} \d{2} \d{2} /g, '') }, status: { ...e.status, privacyStatus: e.status.privacyStatus } }));

	const url = `https://www.googleapis.com/youtube/v3/videos?part=id&part=snippet&part=status`;
	const headers = { Authorization: `Bearer ${customArgs.accessToken}` };
	const options = { method: 'PUT', headers };

	if (customArgs.commit) {
		for (const [idx, item] of Object.entries(projected)) {
			const updateOptions = { ...options, body: JSON.stringify(item) };

			const result = await fetch(url, updateOptions).then(r => r.json());
			console.log(`Successfully updated video ${Number(idx) + 1} of ${projected.length} [${item.id}] [${JSON.stringify(result)}]`);
		}
	} else {
		console.log(JSON.stringify(projected, null, '\t'));
	}
})();