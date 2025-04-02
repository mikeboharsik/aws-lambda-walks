function getBenchmarkedFunction(func) {
	return function(...args) {
		const s = new Date().getTime();
		func(...args);
		console.log(`${func.name} completed in ${new Date().getTime() - s}ms`);
	};
}

function getBenchmarkedFunctionAsync(func) {
	return async function(...args) {
		const s = new Date().getTime();
		const result = await func(...args);
		console.log(`${func.name} completed in ${new Date().getTime() - s}ms`);
		return result;
	};
}

module.exports = {
	getBenchmarkedFunctionAsync,
	getBenchmarkedFunction,
}