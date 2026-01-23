function getDisallowedUserAgents() {
	const DISALLOWED_USER_AGENTS = JSON.parse(process.env.DISALLOWED_USER_AGENTS || '[]');
	console.log('DISALLOWED_USER_AGENTS count:', DISALLOWED_USER_AGENTS.length);
	return DISALLOWED_USER_AGENTS;
}

module.exports = getDisallowedUserAgents;
