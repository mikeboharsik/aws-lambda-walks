import { baseApiUrl } from '../constants/api';
import { parseCsv } from './parseCsv';

export function getApiOptions() {
	let options = { headers: {} };
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

export function withAcceptGeoJson(options) {
	options.headers.Accept = 'application/geo+json';
	return options;
}

export async function getRoute(date) {
	const options = withAcceptTextPlain(getApiOptions());
	const res = await fetch(`${baseApiUrl}/routes?date=${date}`, options);
	const resStr = await res.text();
	if (res.status !== 200) {
		throw new Error(resStr);
	}
	return Promise.resolve(res.text());
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

export async function getEvents(targetPoint, maxRadius) {
	const options = withAcceptGeoJson(getApiOptions());
	return fetch(`${baseApiUrl}/events?targetPoint=${targetPoint}&maxRadius=${maxRadius}`, options)
		.then(res => res.json());
}