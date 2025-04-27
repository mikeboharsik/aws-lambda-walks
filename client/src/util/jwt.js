const tokenStorageKey = 'authToken';

export function storeJwt() {
	try {
		const hashParams = new URLSearchParams(window.location.hash.replace('#',''));
		const token = hashParams.get('access_token');
		if (token) {
			localStorage.setItem(tokenStorageKey, token);
			history.pushState('', document.title, '/');
		}
	} catch (e) {
		console.log(e);
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