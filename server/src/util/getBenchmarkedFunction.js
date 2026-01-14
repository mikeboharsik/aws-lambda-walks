function getBenchmarkedFunction(func) {
	return function(...args) {
		const s = new Date().getTime();
		const result = func(...args);
		const event = args[0];
		if (event && typeof event.log === 'function') {
			event.log(`${func.name} completed in ${new Date().getTime() - s}ms`);
		} else {
			console.log('Failed to find event logger');
		}
		return result;
	};
}

function getBenchmarkedFunctionAsync(func) {
	return async function(...args) {
		const s = new Date().getTime();
		const result = await func(...args);
		const event = args[0];
		if (event && typeof event.log === 'function') {
			event.log(`${func.name} completed in ${new Date().getTime() - s}ms`);
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