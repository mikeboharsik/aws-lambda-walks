const path = require('path');
const crypto = require('crypto');

require('./setupLoggers.js');
require('dotenv').config({ path: [path.resolve(`${__dirname}/../.env`)], quiet: true });

const { authenticate } = require('./auth.js');
const { handleApiRequest } = require('./handleApiRequest.js');
const { handleAuthResponseRequest } = require('./handleAuthResponseRequest.js');
const { handleContentRequest } = require('./handleContentRequest.js');
const { verifyCacheValue } = require('./verifyCacheValue.js');
const { setJsonContentType } = require('./setJsonContentType.js');
const { verifyBodyIsString } = require('./verifyBodyIsString.js');

const ALLOWED_HOSTS = process.env.ALLOWED_HOSTS ? process.env.ALLOWED_HOSTS.split(',') : [];
const DISALLOWED_IP_ADDRESSES = process.env.DISALLOWED_IP_ADDRESSES ? process.env.DISALLOWED_IP_ADDRESSES.split(',') : [];
const DISALLOWED_USER_AGENTS = JSON.parse(process.env.DISALLOWED_USER_AGENTS || '[]');

function logResult(result, event) {
	if (process.env.LOG_RESULT === 'true') {
		event.log('Returning result', JSON.stringify(result, null, '  '));
	} else {
		event.log('Returning status code', result.statusCode);
	}
}

function logEvent(event) {
	const copy = JSON.parse(JSON.stringify(event));
	if (copy.cookies) {
		copy.cookies?.forEach?.((cookie, idx) => {
			if (cookie.startsWith('access_token')) {
				const [k, v] = cookie.split('=');
				if (k === 'access_token') {
					const newCookie = k + '=' + v.slice(0, 10) + '...' + v.slice(-10);
					copy.cookies.splice(idx, 1, newCookie);
				}
			}
		});
		delete copy.cookiesParsed;
		delete copy.headers?.cookie;
		delete copy.headers?.cookies;
		delete copy.headers?.Cookie;
		delete copy.headers?.Cookies;
	}
	event.log(JSON.stringify(copy));
}

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
}

exports.handler = async (event, ignoreAuth = false) => {
	const requestId = crypto.randomUUID();
	event.log = function log(...args) {
		console.log(`[${requestId}]`, ...args);
	};
	event.logError = function logError(...args) {
		console.error(`[${requestId}]`, ...args);
	};
	event.cookies = event.cookies || event.headers?.cookie?.split(';').map(e => e.trim()) || [];
	event.cookiesParsed = event.cookies.map(e => e.split('=')).reduce((acc, [k, v]) => { if (k) { acc[k] = v; } return acc; }, {});

	try {
		logEvent(event);

		const prevalidationResult = getPrevalidationResult(event);
		if (prevalidationResult) {
			return prevalidationResult;
		}

		const { rawPath } = event;
		if (Boolean(process.env['LOG_RAW_PATH'])) {
			event.log(rawPath);
		}

		try {
			if (event.body) {
				event.body = JSON.parse(atob(event.body));
			}
		} catch (e) {
			console.warn('Body seems to exist but it failed to parse', e);
		}

		if (ignoreAuth === true) {
			event.isAuthed = true;
		} else if (event.cookiesParsed.access_token) {
			await authenticate(event);
		}

		const isApiRequest = rawPath.startsWith('/api');
		const isAuthResponseRequest = rawPath.startsWith('/authresp');
		const handlerFunction = isAuthResponseRequest ? handleAuthResponseRequest : isApiRequest ? handleApiRequest : handleContentRequest;

		let result = await handlerFunction(event);
		if (!result.statusCode) {
			throw new Error(`The result returned has an incorrect format: ${JSON.stringify(result)}`);
		}

		verifyBodyIsString(result);
		if (process.env.ENABLE_CACHING === 'true') {
			verifyCacheValue(event, result, rawPath);
		}
		logResult(result, event);

		return result;
	} catch (e) {
		event.logError('Unhandled exception:', e);

		event.log('Returning status code', 500);
		return setJsonContentType({
			statusCode: 500,
			body: JSON.stringify({ error: e.message }),
		});
	}
};
