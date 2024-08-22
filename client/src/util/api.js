export function getApiOptions() {
	let options = { headers: {} };

	let accessToken = localStorage.getItem('access_token');
	if (accessToken) {
		options.headers.Authorization = `Bearer ${accessToken}`;
	}

	return options;
}

export function withAcceptCsv(options) {
	options.headers.Accept = 'text/csv';
	return options;
}