{
	try {
			const originalFileName = document.querySelector('#original-filename').textContent.trim();
			const [,dateFromFileName] = originalFileName.match(/(\d{4}-\d{2}-\d{2})/);
			
			const data = await fetch(`https://localhost/events?date=${dateFromFileName}`).then(res => res.json())

			const titleInput = document.querySelector("[aria-label ^= 'Add']")
			const descriptionInput = document.querySelector("[aria-label ^= 'Tell']")
			
			console.log({ data, titleInput, descriptionInput });
			
			({ date, endMark, startMark, towns, videos } = data);
			
			function getTitleContent() {
				let townsContent = null;
			
				states = Object.keys(towns);
				if (states.length === 1) {
					([curState] = states);
					towns = towns[curState];
					if (towns.length === 1) {
						townsContent = `${towns}, ${curState}`;
					} else if (towns.length === 2) {
						([first, second] = towns);
						townsContent = `${first} & ${second}, ${curState}`;
					} else {
						townsContent = `${towns.slice(0, -1).join(', ')}, & ${towns.slice(-1)}`;
					}
				} else {
					throw "not implemented";
				}
			
				return `${date} Walk - ${townsContent}`;
			}
			
			function getDescriptionContent() {
				let listeningToContent = null;
			
				if (Object.keys(videos).length) {
					listeningToContent = Object.keys(videos).map((videoId) => {
						finalVideoStartSeconds = 0;
						([vidStart, walkVidStart] = videos[videoId] ?? []);
						if (vidStart && walkVidStart && startMark) {
							([vHours = 0, vMinutes = 0, vSeconds = 0] = vidStart.split(':').map(e => parseInt(e)));
							([wHours = 0, wMinutes = 0, wSeconds = 0] = walkVidStart.split(':').map(e => parseInt(e)));
							([sHours = 0, sMinutes = 0, sSeconds = 0] = startMark.split(':').map(e => parseInt(e)));
							vidStartSeconds = (vHours * 60 * 60) + (vMinutes * 60) + vSeconds;
							walkVidStartSeconds = (wHours * 60 * 60) + (wMinutes * 60) + parseInt(wSeconds);
							startSeconds = (sHours * 60 * 60) + (sMinutes * 60) + sSeconds;
							finalVideoStartSeconds = (vidStartSeconds - walkVidStartSeconds) + startSeconds;
						}
						
						switch (videoId) {
							case 'hasanabi':
							case 'kitboga': {
								return `https://twitch.tv/${videoId}?t=${finalVideoStartSeconds}`;
							}
							default: {
								return `https://youtu.be/${videoId}?t=${finalVideoStartSeconds}`;
							}
						}
					}).join('\n');
				}
			
				let out = `Route: https://walks.mikeboharsik.com/routes?date=${date}\n\n`;
				if (listeningToContent) {
					out += `Listening to:\n${listeningToContent}\n\n`;
				}
				out += `https://github.com/lindell/JsBarcode`;
			
				return out;
			}
			
			let titleContent = getTitleContent();
			let descriptionContent = getDescriptionContent();
			
			titleInput.textContent = titleContent;
			titleInput.value = titleContent;
			
			descriptionInput.textContent = descriptionContent;
			descriptionInput.value = descriptionContent;
	} catch (e) {
			console.error(e);
	}
};