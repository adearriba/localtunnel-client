module.exports.generateExponentialBackoffRetryFn = function generateExponentialBackoffRetryFn(initialDelay, maxDelay, maxRetries = Infinity) {
    return (attempt) => {
        if (attempt < maxRetries) {
            return Math.min(Math.pow(2, attempt) * initialDelay, maxDelay);
        } else {
            throw 'No more retries left';
        }
    }
}