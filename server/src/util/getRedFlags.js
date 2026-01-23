function getRedFlags() {
	return [
		'.env',
		'.git',
		'.php',
		'wp-admin',
		'wp-content',
		'wp-include',
	];
}

module.exports = getRedFlags;
