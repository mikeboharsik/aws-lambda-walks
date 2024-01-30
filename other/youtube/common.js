const fs = require('fs');

function getCustomArguments(init = {}) {
	const keys = Object.keys(init);
	if (process.argv.length === 2 && keys.length) {
		let keysLog = keys.reduce((acc, cur) => { acc.push(`  - ${cur}`); return acc; }, []).join('\n');

		return `Arguments:\n${keysLog}`;
	}

	const customArgs = init;
	
	process.argv.forEach(e => {
		let [k, v] = e.split('=');
		
		if (k in customArgs) {
			if (v === 'true') v = true;
			
			customArgs[k] = v;
		}
	});

	return customArgs;
}

function getAllVideoItems() {
	return JSON.parse(fs.readFileSync('./uploads_videoitems.json'));
}

function shuffleArray(e) {
	for (let i = e.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const temp = e[i];
		e[i] = e[j];
		e[j] = temp;
	}
	return e;
}

module.exports = {
	getAllVideoItems,
	getCustomArguments,
	shuffleArray,
};
