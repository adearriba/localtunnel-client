const { EventEmitter } = require('events');
const debug = require('debug')('localtunnel:client');
const fs = require('fs');
const net = require('net');
const tls = require('tls');

const HeaderHostTransformer = require('./HeaderHostTransformer');
const { generateExponentialBackoffRetryFn } = require('./Utils');

const localRetryPolicy = generateExponentialBackoffRetryFn(1000, 10000, 5);

class TunnelConnection extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.opts = opts;
        this.remote = null;
        this.local = null;
        this.remoteConnectTimeout = 5000; // 5 seconds timeout
    }

    async open() {
        try {
            await this.connectRemote();
            await this.connectLocalWithRetry();
        } catch (err) {
            this.emit('error', err);
        }
    }

    async connectRemote() {
        const { remote_ip, remote_host, remote_port } = this.opts;
        const remoteHostOrIp = remote_ip || remote_host;

        debug(`Attempting to connect to remote ${remoteHostOrIp}:${remote_port}`);

        return new Promise((resolve, reject) => {
            this.remote = net.connect({
                host: remoteHostOrIp,
                port: remote_port,
            });

            this.remote.setKeepAlive(true);

            const timeout = setTimeout(() => {
                debug('Remote connection timed out');
                this.remote.destroy(new Error('Connection timeout'));
            }, this.remoteConnectTimeout);

            this.remote.once('connect', () => {
                clearTimeout(timeout);
                debug('Connected to remote');
                this.handleRemoteConnect();
                resolve();
            });

            this.remote.once('error', (err) => {
                clearTimeout(timeout);
                debug('Remote connection error', err.message);
                this.remote.destroy();
                reject(err);
            });

            this.remote.on('data', this.handleRemoteData.bind(this));
        });
    }

    async connectLocalWithRetry() {
        let attempt = 0;
        while (true) {
            try {
                await this.connectLocal();
                return;
            } catch (err) {
                attempt++;
                if (err.message === 'Max retries reached') {
                    throw new Error('Failed to connect to local server after maximum retries');
                }
                const delay = localRetryPolicy(attempt);
                debug(`Local connection failed. Retrying in ${delay}ms. Attempt: ${attempt}`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    async connectLocal() {
        if (this.remote.destroyed) {
            debug('remote destroyed');
            this.emit('dead', this);
            return;
        }

        const { local_https, local_host, local_port, allow_invalid_cert } = this.opts;

        debug('connecting locally to %s://%s:%d', local_https ? 'https' : 'http', local_host || 'localhost', local_port);
        this.remote.pause();

        if (allow_invalid_cert) {
            debug('allowing invalid certificates');
        }

        const getLocalCertOpts = () =>
            allow_invalid_cert
                ? { rejectUnauthorized: false }
                : {
                    cert: fs.readFileSync(this.opts.local_cert),
                    key: fs.readFileSync(this.opts.local_key),
                    ca: this.opts.local_ca ? [fs.readFileSync(this.opts.local_ca)] : undefined,
                };

        return new Promise((resolve, reject) => {
            this.local = local_https
                ? tls.connect({ host: local_host, port: local_port, ...getLocalCertOpts() })
                : net.connect({ host: local_host, port: local_port });

            const remoteClose = () => {
                debug('remote close');
                this.emit('dead', this);
                this.local.end();
            };

            this.remote.once('close', remoteClose);

            this.local.once('error', (err) => {
                debug('local error %s', err.message);
                this.local.end();

                this.remote.removeListener('close', remoteClose);

                if (err.code !== 'ECONNREFUSED'
                    && err.code !== 'ECONNRESET') {
                    return this.remote.end();
                }

                reject(err);
            });

            this.local.once('connect', () => {
                debug('connected locally');
                this.remote.resume();

                let stream = this.remote;

                if (this.opts.local_host) {
                    debug('transform Host header to %s', this.opts.local_host);
                    stream = this.remote.pipe(new HeaderHostTransformer({ host: this.opts.local_host }));
                }

                stream.pipe(this.local).pipe(this.remote);

                this.local.once('close', hadError => {
                    debug('local connection closed [%s]', hadError);
                });

                resolve();
            });
        });
    }

    handleRemoteConnect() {
        this.emit('open', this.remote);
    }

    handleRemoteData(data) {
        const match = data.toString().match(/^(\w+) (\S+)/);
        if (match) {
            this.emit('request', {
                method: match[1],
                path: match[2],
            });
        }
    }

    close() {
        if (this.remote) this.remote.destroy();
        if (this.local) this.local.destroy();
    }
}

module.exports = TunnelConnection;