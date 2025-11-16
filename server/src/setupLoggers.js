const ogDebug = console.debug;
const ogLog = console.log;
const ogWarn = console.warn;
const ogError = console.error;

function conditionalLog(func, message, ...params) {
	if (process.env.AWS_EXECUTION_ENV || process.env.ENABLE_LOGGING) {
		return func(message, ...params);
	}
}
console.debug = (message, ...params) => conditionalLog(ogDebug, message, ...params);
console.log = (message, ...params) => conditionalLog(ogLog, message, ...params);
console.warn = (message, ...params) => conditionalLog(ogWarn, message, ...params);
console.error = (message, ...params) => conditionalLog(ogError, message, ...params);
