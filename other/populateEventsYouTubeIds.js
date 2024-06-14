(async () => {
	await Promise.all(Array.from(document.querySelectorAll('a#video-title')).map(async e => {
		const [,date] = e.textContent.trim().match(/(\d{4}-\d{2}-\d{2}) Walk/) ?? [];
		const [,id] = e.href.match(/\/video\/(\S+)\/edit/) ?? [];
		if (date && id) {
			await fetch('https://localhost/setYoutubeId', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ date, id }),
			});
		}
	}));
})();