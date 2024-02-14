doShit = (links, idx) => {
	if (idx < links.length) {
		newWindow = window.open(links[idx]);
		setTimeout(() => {
			content = newWindow.document.querySelector('ytcp-shorts-content-links-picker')
				.querySelectorAll('.dropdown-trigger-text.style-scope.ytcp-text-dropdown-trigger')[0].textContent
				.trim();
		
			if (content !== 'None') {
				newWindow.close();
			}

			doShit(links, idx + 1);
		}, 5000);
	}
	return;
}

links = Array.from(document.querySelectorAll('.remove-default-style.style-scope.ytcp-video-list-cell-video'))
	.reduce((acc, cur) => {
		if (!acc.includes(cur.href)) { acc.push(cur.href); } return acc;
	}, []);

doShit(links, 0);
