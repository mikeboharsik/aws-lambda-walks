function getAllowedHosts() {
	const ALLOWED_HOSTS = process.env.ALLOWED_HOSTS ? process.env.ALLOWED_HOSTS.split(',') : [];
	console.log('ALLOWED_HOSTS count:', ALLOWED_HOSTS.length);
	return ALLOWED_HOSTS;
}

module.exports = getAllowedHosts;
