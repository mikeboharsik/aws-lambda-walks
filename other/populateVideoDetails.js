data = JSON.parse(
	atob(
		document.querySelector('#original-filename').textContent.trim().slice(0, -4)
	)
);

console.log(data);

const [, titleInput, descriptionInput] = Array.from(document.querySelectorAll("div[aria-label]"));

console.log({ titleInput, descriptionInput });

({ date, end, route, start, towns, videos } = data);

function getTitleContent() {
	townsContent = 'not implemented';

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
	listeningToContent = 'not implemented';

	listeningToContent = Object.keys(videos).map((videoId) => {
        finalVideoStartSeconds = 0;
		([vidStart, walkVidStart] = videos[videoId] ?? []);
        if (vidStart && walkVidStart && start) {
            ([vHours = 0, vMinutes = 0, vSeconds = 0] = vidStart.split(':').map(e => parseInt(e)));
            ([wHours = 0, wMinutes = 0, wSeconds = 0] = walkVidStart.split(':').map(e => parseInt(e)));
            ([sHours = 0, sMinutes = 0, sSeconds = 0] = start.split(':').map(e => parseInt(e)));
            vidStartSeconds = (vHours * 60 * 60) + (vMinutes * 60) + vSeconds;
            walkVidStartSeconds = (wHours * 60 * 60) + (wMinutes * 60) + parseInt(wSeconds);
            startSeconds = (sHours * 60 * 60) + (sMinutes * 60) + sSeconds;
            finalVideoStartSeconds = (vidStartSeconds - walkVidStartSeconds) + startSeconds;
        }
		if (videoId === 'hasanabi') {
			return `https://twitch.tv/hasanabi?t=${finalVideoStartSeconds}`;
		} else {
			return `https://youtu.be/${videoId}?t=${finalVideoStartSeconds}`;
		}
	}).join('\n');

	return `Route: ${route}\n\nListening to:\n${listeningToContent}\n\nhttps://github.com/lindell/JsBarcode`;
}

titleContent = getTitleContent();
descriptionContent = getDescriptionContent();

titleInput.textContent = titleContent;
titleInput.value = titleContent;

descriptionInput.textContent = descriptionContent;
descriptionInput.value = descriptionContent;
