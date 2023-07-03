data = JSON.parse(
	atob(
		document.querySelector('#original-filename').textContent.trim().slice(0, -4)
	)
);

console.log(data);

const [titleInput, descriptionInput] = Array.from(document.querySelectorAll('#textbox'));

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
		([vidStart, walkVidStart] = videos[videoId] ?? []);
		if (videoId === 'hasanabi') {
			return `https://twitch.tv/hasanabi`;
		} else {
			return `https://youtu.be/${videoId}`;
		}
	}).join('\n');

	return `Route: ${route}\n\nListening to:\n${listeningToContent}`;
}

titleContent = getTitleContent();
descriptionContent = getDescriptionContent();

titleInput.innerHTML = titleContent;
titleInput.textContent = titleContent;
titleInput.value = titleContent;

descriptionInput.innerHTML = descriptionContent;
descriptionInput.textContent = descriptionContent;
descriptionInput.value = descriptionContent;
