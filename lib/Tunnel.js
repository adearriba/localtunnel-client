const { parse } = require('url');
const { EventEmitter } = require('events');
const axios = require('axios');
const debug = require('debug')('localtunnel:client');

const TunnelCluster = require('./TunnelCluster');

class Tunnel extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.opts = opts;
    this.closed = false;
    this.tunnelCount = 0;
    this.retryDelay = 1000;
    this.maxRetries = 5;
    this.opts.host = this.opts.host || 'https://localtunnel.me';
  }

  async open() {
    try {
      const info = await this._init();
      this.clientId = info.name;
      this._url = info.url;
      if (info.cached_url) {
        this.cachedUrl = info.cached_url;
      }
      await this._establish(info);
      this.emit('open', this._url);
    } catch (err) {
      this.emit('error', err);
    }
  }

  async _init() {
    const opt = this.opts;
    const baseUri = `${opt.host}/`;
    const assignedDomain = opt.subdomain;
    const uri = baseUri + (assignedDomain || '?new');

    const params = {
      responseType: 'json',
      headers: opt.api_key ? { 'api-key': opt.api_key } : {},
    };

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const res = await axios.get(uri, params);
        if (res.status !== 200) {
          throw new Error(res.data.message || 'Localtunnel server returned an error, please try again');
        }
        return this._getInfo(res.data);
      } catch (err) {
        if (err.response && err.response.status === 401) {
          debug('tunnel server response: %s', err.response.data);
          throw err;
        }
        if (attempt === this.maxRetries - 1) {
          throw new Error(`Failed to connect to tunnel server after ${this.maxRetries} attempts`);
        }
        debug(`tunnel server offline: ${err.message}, retrying in ${this.retryDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      }
    }
  }

  _getInfo(body) {
    const { id, ip, port, url, cached_url, max_conn_count } = body;
    const { host, port: local_port, local_host } = this.opts;
    const { local_https, local_cert, local_key, local_ca, allow_invalid_cert } = this.opts;
    return {
      name: id,
      url,
      cached_url,
      max_conn: max_conn_count || 1,
      remote_host: parse(host).hostname,
      remote_ip: ip,
      remote_port: port,
      local_port,
      local_host,
      local_https,
      local_cert,
      local_key,
      local_ca,
      allow_invalid_cert,
    };
  }

  async _establish(info) {
    this.setMaxListeners(info.max_conn + EventEmitter.defaultMaxListeners);

    this.tunnelCluster = new TunnelCluster(info);

    this.tunnelCluster.on('open', this._handleTunnelOpen.bind(this));
    this.tunnelCluster.on('error', this._handleTunnelError.bind(this));
    this.tunnelCluster.on('dead', this._handleTunnelDead.bind(this));
    this.tunnelCluster.on('request', this._handleTunnelRequest.bind(this));

    for (let count = 0; count < info.max_conn; ++count) {
      await this.tunnelCluster.open();
    }
  }

  _handleTunnelOpen(tunnel) {
    this.tunnelCount++;
    debug('tunnel open [total: %d]', this.tunnelCount);

    const closeHandler = () => {
      tunnel.destroy(new Error('Tunnel is closed'));
    };

    if (this.closed) {
      return closeHandler();
    }

    this.once('close', closeHandler);
    tunnel.once('close', () => {
      this.removeListener('close', closeHandler);
    });
  }

  _handleTunnelError(err) {
    debug('got tunnel error', err.message);
    this.emit('error', err);
  }

  async _handleTunnelDead() {
    this.tunnelCount--;
    debug('tunnel dead [total: %d]', this.tunnelCount);
    if (this.closed) {
      return;
    }
    try {
      await this.tunnelCluster.open();
    } catch (err) {
      this.emit('error', new Error(`Failed to reopen tunnel: ${err.message}`));
    }
  }

  _handleTunnelRequest(req) {
    this.emit('request', req);
  }

  get url() {
    if (!this._url) throw new Error('Tunnel has no URL');
    return this._url;
  }

  close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    if (this.tunnelCluster) {
      this.tunnelCluster.close();
    }
    this.emit('close');
  }
}

module.exports = Tunnel;