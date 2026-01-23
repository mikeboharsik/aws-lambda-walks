const fs = require('fs');

function getDisallowedIpAddresses() {
	const DISALLOWED_IP_ADDRESSES = process.env.DISALLOWED_IP_ADDRESSES ? process.env.DISALLOWED_IP_ADDRESSES.split(',') : [];
	try {
		const storedIps = fs.readFileSync(GARBAGE_PATH, 'utf8').split('\n').filter(e => e.trim());
		const uniqueStoredIps = new Set(storedIps);
		DISALLOWED_IP_ADDRESSES.push(...uniqueStoredIps);
		console.log(`Loaded [${storedIps.length}] disallowed IP addresses from [${GARBAGE_PATH}]`);
	} catch {}
	console.log('DISALLOWED_IP_ADDRESSES count:', DISALLOWED_IP_ADDRESSES.length);
	return DISALLOWED_IP_ADDRESSES;
}

module.exports = getDisallowedIpAddresses;
