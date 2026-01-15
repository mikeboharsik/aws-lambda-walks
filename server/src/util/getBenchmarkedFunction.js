function getBenchmarkedFunction(func) {
	return function(...args) {
		const s = performance.now()
		const result = func(...args);
		const event = args[0];
		if (event && typeof event.log === 'function') {
			event.log(`${func.name} completed in ${(performance.now() - s).toFixed(3)} milliseconds`);
		} else {
			console.log('Failed to find event logger');
		}
		return result;
	};
}

function getBenchmarkedFunctionAsync(func) {
	return async function(...args) {
		const s = performance.now();
		const result = await func(...args);
		const event = args[0];
		if (event && typeof event.log === 'function') {
			event.log(`${func.name} completed in ${(performance.now() - s).toFixed(3)} milliseconds`);
		} else {
			console.log('Failed to find event logger');
		}
		return result;
	};
}

module.exports = {
	getBenchmarkedFunctionAsync,
	getBenchmarkedFunction,
}