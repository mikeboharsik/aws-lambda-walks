const tokenStorageKey = 'authToken';

export function storeJwt() {
	const hash = window.location.hash;
	if (hash !== '') {
		const [key, val] = hash.replace('#', '').split('=');
		if (key === 'token') {
			localStorage.setItem(tokenStorageKey, val);
			history.pushState('', document.title, '/');
		}
	}
}

export function getJwt() {
	return localStorage.getItem(tokenStorageKey);
}