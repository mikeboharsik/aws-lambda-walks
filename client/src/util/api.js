export function getApiOptions() {
	let options = {};

	let accessToken = localStorage.getItem('access_token');
	if (accessToken) {
		options.headers = { 'Authorization': `Bearer ${accessToken}` };
	}

	return options;
}