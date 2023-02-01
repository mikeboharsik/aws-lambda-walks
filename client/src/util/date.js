function padNumber(n) {
	return n.toString().padStart(2, '0');
}

export function getPaddedDateString(date) {
	return `${padNumber(date.getFullYear())}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

export function getPaddedTimeString(date) {
	return `${padNumber(date.getHours())}:${padNumber(date.getMinutes())}:${padNumber(date.getSeconds())}`;
}
