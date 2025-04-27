const tokenStorageKey = 'authToken';

export function storeJwt() {
	const hash = window.location.hash;
	if (hash !== '') {
		const [key, val] = hash.replace('#', '').split('=');
		if (key === 'access_token') {
			localStorage.setItem(tokenStorageKey, val);
			history.pushState('', document.title, '/');
		}
	}
}

export function getJwt() {
	const storedJwt = localStorage.getItem(tokenStorageKey);
	if (!storedJwt) return null;

	const { exp } = storedJwt.split('.').slice(1, 2).map(e => JSON.parse(atob(e))).at(0);	

	const now = new Date();
	const expireTime = new Date(exp * 1000);
	if (now > expireTime) {
		localStorage.removeItem(tokenStorageKey);
		return null;
	}

	return storedJwt;
}