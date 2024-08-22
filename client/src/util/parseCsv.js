export function parseCsv(rawCsv) {
	const result = rawCsv
		.split("\n")
		.filter(e => e)
		.reduce((acc, cur, idx, arr) => {
			if(idx > 0) {
				const [joinedKeys] = arr;
				const keys = joinedKeys.split(",");
				const curPieces = cur.split(",");
				const newEntry = {};
				for (let i = 0; i < keys.length; i++) {
					const key = keys[i].slice(1, -1);
					let val = curPieces[i].slice(1, -1);
					try {
						newEntry[key] = JSON.parse(val);
					} catch {
						newEntry[key] = val;
					}
				}
				acc.push(newEntry);
			}
			return acc;
		}, []);

	return result;
}
