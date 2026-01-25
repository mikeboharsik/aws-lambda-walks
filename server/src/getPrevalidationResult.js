const fsPromises = require('fs/promises');

const getGarbagePath = require('./util/getGarbagePath.js');
const getAllowedHosts = require('./util/getAllowedHosts.js');
const getRedFlags = require('./util/getRedFlags.js');
const getDisallowedIpAddresses = require('./util/getDisallowedIpAddresses.js');
const getDisallowedUserAgents = require('./util/getDisallowedUserAgents.js');

const logResult = require('./util/logResult.js');

const GARBAGE_PATH = getGarbagePath();
const RED_FLAGS = getRedFlags();
const ALLOWED_HOSTS = getAllowedHosts();
const DISALLOWED_IP_ADDRESSES = getDisallowedIpAddresses();
const DISALLOWED_USER_AGENTS = getDisallowedUserAgents();

function getPrevalidationResult(event) {
	if (ALLOWED_HOSTS.length && !ALLOWED_HOSTS.includes(event.headers?.host)) {
		event.log(event.headers?.host, 'is not an allowed host');
		const result = { statusCode: 404 };
		logResult(result, event);
		return result;
	}
	if (DISALLOWED_IP_ADDRESSES && DISALLOWED_IP_ADDRESSES.includes(event.headers?.['cf-connecting-ip'])) {
		event.log(event.headers?.['cf-connecting-ip'], 'is not an allowed IP address');
		const result = { statusCode: 403 };
		logResult(result, event);
		return result;
	}
	if (DISALLOWED_USER_AGENTS && DISALLOWED_USER_AGENTS.includes(event.headers?.['user-agent'])) {
		event.log(event.headers?.['user-agent'], 'is not an allowed user-agent');
		const result = { statusCode: 403 };
		logResult(result, event);
		return result;
	}

	if (RED_FLAGS.some(rf => event.rawPath.includes(rf))) {
		const clientIpAddress = event.headers?.['cf-connecting-ip'];
		if (clientIpAddress) {
			DISALLOWED_IP_ADDRESSES.push(clientIpAddress);
			fsPromises.appendFile(GARBAGE_PATH, event.headers?.['cf-connecting-ip'] + '\n')
				.then(() => console.log(`Added ${clientIpAddress} to garbage`))
				.catch((e) => console.log('Failed to write IP address', e));
		}

		const result = { statusCode: 403 };
		logResult(result, event);
		return result;
	}
}

module.exports = getPrevalidationResult;
