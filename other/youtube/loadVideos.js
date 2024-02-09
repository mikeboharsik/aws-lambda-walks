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
	
	let playlistPages = [];
	if (customArgs.refreshPlaylistItems) {
		// 1 quota unit
		const channelUrl = `https://youtube.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true`;

		let channelResponse
		try {
			channelResponse = await fetch(channelUrl, { headers }).then(r => r.json());
			const uploadsPlaylistId = channelResponse.items[0].contentDetails.relatedPlaylists.uploads;
			
			// 1 quota unit
			let playlistItemsUrl = `https://youtube.googleapis.com/youtube/v3/playlistItems?part=id&part=contentDetails&part=snippet&part=status&maxResults=50&playlistId=${uploadsPlaylistId}`;
			
			let pageToken = null;
			do {
				let url = playlistItemsUrl;
				if (pageToken) { url += `&pageToken=${pageToken}` };
				
				const playlistResult = await fetch(url, { headers }).then(r => r.json());
				pageToken = playlistResult.nextPageToken;
				
				playlistPages.push(playlistResult);
			} while(pageToken);
			
			await fs.writeFile('./uploads_playlistitems.json', JSON.stringify(playlistPages, null, '\t'));
		} catch (e) {
			console.log(JSON.stringify(channelResponse));
			throw e;
		}
	} else {
		playlistPages = JSON.parse(await fs.readFile('./uploads_playlistitems.json'));
	}
	
	console.log(`Found ${playlistPages.length} playlist items`);

	const videoIds = playlistPages.flatMap(p => p.items.map(e => e.contentDetails.videoId ));
	
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
	
	let videoPages = [];
	if (customArgs.refreshVideoItems) {	
		const batchSize = 50;
		let batchesRun = 0;
		while (batchSize * batchesRun < videoIds.length) {
			const batchIds = videoIds.slice(batchesRun * batchSize, batchesRun * batchSize + batchSize);
			
			const url = videosUrl + `&id=${batchIds.join(',')}`
			const videosRes = await fetch(url, { headers }).then(r => r.json());
			
			videoPages.push(videosRes);
			
			batchesRun++;

			console.log(`Loaded video items page ${batchesRun} of ${Math.ceil(videoIds.length / batchSize)}`);
		}
		
		const videoCount = playlistPages.reduce((acc, cur) => acc + cur.items.length, 0);
		console.log(`Retrieved ${videoCount} videos over ${batchesRun} pages`);

		await fs.writeFile('./uploads_videoitems.json', JSON.stringify(videoPages, null, '\t'));
	} else {
		videoPages = JSON.parse(await fs.readFile('./uploads_videoitems.json'));
		console.log(`Loaded ${videoPages.length} pages of videos with a total of ${videoPages.reduce((acc, cur) => acc + cur.items.length, 0)} videos`);
	}
})();
