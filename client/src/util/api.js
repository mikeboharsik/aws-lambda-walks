import { baseApiUrl } from '../constants/api';
import { parseCsv } from './parseCsv';
import { getJwt } from './jwt';

export function getApiOptions() {
	let options = { headers: {} };

	let accessToken = getJwt();
	if (accessToken) {
		options.headers.Authorization = `Bearer ${accessToken}`;
	}

	return options;
}

export function withAcceptCsv(options) {
	options.headers.Accept = 'text/csv';
	return options;
}

export function withAcceptTextPlain(options) {
	options.headers.Accept = 'text/plain';
	return options;
}

export async function getRoute(date) {
	const options = withAcceptTextPlain(getApiOptions());
	return fetch(`${baseApiUrl}/routes?date=${date}`, options)
		.then(res => res.text());
}

export async function getWalks(q) {
	const options = withAcceptCsv(getApiOptions());
	return fetch(`${baseApiUrl}/walks?q=${q}`, options)
		.then(res => res.text())
		.then(res => parseCsv(res))
}

export async function getGit() {
	const options = getApiOptions();
	return fetch(`${baseApiUrl}/git`, options)
		.then(res => res.json());
}

export async function getSunx(date) {
	const options = getApiOptions();
	return fetch(`${baseApiUrl}/sunx?date=${date}`, options)
		.then(res => res.json());
}

export async function getGlobalStats() {
	const options = getApiOptions();
	return fetch(`${baseApiUrl}/globalStats`, options)
		.then(res => res.json());
}