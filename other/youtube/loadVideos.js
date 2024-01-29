const fs = require('fs/promises');

const { getCustomArguments } = require('./common.js');

(async function(){
	const customArgs = getCustomArguments({
		accessToken: null,
		refreshPlaylistItems: false,
		refreshVideoItems: false
	});
	if (typeof customArgs === 'string') {
		console.log(customArgs);
		return;
	}

	const accessTokenRequired = customArgs.refreshPlaylistItems || customArgs.refreshVideoItems;
	if (accessTokenRequired && !customArgs.accessToken) {
		throw new Error('accessToken is required');
	}
	
	const headers = { 'Authorization': `Bearer ${customArgs.accessToken}` };
	
	let playlistItems = [];
	if (customArgs.refreshPlaylistItems) {
		// 1 quota unit
		const channelUrl = `https://youtube.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true`;

		const channelResponse = await fetch(channelUrl, { headers }).then(r => r.json());
		const uploadsPlaylistId = channelResponse.items[0].contentDetails.relatedPlaylists.uploads;
		
		// 1 quota unit
		let playlistItemsUrl = `https://youtube.googleapis.com/youtube/v3/playlistItems?part=id&part=contentDetails&part=snippet&part=status&maxResults=50&playlistId=${uploadsPlaylistId}`;
		
		let pageToken = null;
		do {
			let url = playlistItemsUrl;
			if (pageToken) { url += `&pageToken=${pageToken}` };
			
			const playlistResult = await fetch(url, { headers }).then(r => r.json());
			pageToken = playlistResult.nextPageToken;
			
			playlistItems.push(...playlistResult.items);
		} while(pageToken);
		
		await fs.writeFile('./uploads_playlistitems.json', JSON.stringify(playlistItems, null, '\t'));
	} else {
		playlistItems = JSON.parse(await fs.readFile('./uploads_playlistitems.json'));
	}
	
	const videoIds = playlistItems.map(e => e.contentDetails.videoId);
	
	// get: 1 quota unit
	// put: 50 quota units
	const parts = 'part=' +[
		'contentDetails',
		'fileDetails',
		'id',
		'liveStreamingDetails',
		'localizations',
		'player',
		'processingDetails',
		'recordingDetails',
		'snippet',
		'statistics',
		'status',
		'suggestions',
		'topicDetails'
	].join('&part=');
	const videosUrl = `https://youtube.googleapis.com/youtube/v3/videos?${parts}&maxResults=50`;
	
	let videoItems = [];
	if (customArgs.refreshVideoItems) {	
		const batchSize = 50;
		let batchesRun = 0;
		while (batchSize * batchesRun < videoIds.length) {
			const batchIds = videoIds.slice(batchesRun * batchSize, batchesRun * batchSize + batchSize);
			
			const url = videosUrl + `&id=${batchIds.join(',')}`
			const videosRes = await fetch(url, { headers }).then(r => r.json());
			
			videoItems.push(...videosRes.items);
			
			batchesRun++;
		}
		
		await fs.writeFile('./uploads_videoitems.json', JSON.stringify(videoItems, null, '\t'));
	} else {
		videoItems = JSON.parse(await fs.readFile('./uploads_videoitems.json'));
	}
})();
