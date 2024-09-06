module.exports.generateExponentialBackoffRetryFn = (initialDelay, maxDelay, maxRetries = Infinity, jitter = true) => {
    return (attempt) => {
        if (attempt >= maxRetries) {
            throw new Error('Max retries reached');
        }

        const delay = Math.min(Math.pow(2, attempt) * initialDelay, maxDelay);

        // Add jitter to prevent thundering herd problem
        const jitteredDelay = jitter ? delay * (0.5 + Math.random()) : delay;

        return Math.floor(jitteredDelay);
    };
};