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

module.exports = {
	getAllVideoItems,
	getCustomArguments,
};
