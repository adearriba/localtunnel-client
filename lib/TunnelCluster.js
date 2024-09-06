const { EventEmitter } = require('events');
const TunnelConnection = require('./TunnelConnection');
const debug = require('debug')('localtunnel:client');

class TunnelCluster extends EventEmitter {
  constructor(opts = {}) {
    super(opts);
    this.opts = opts;
    this.connections = new Set();
    this.openConnections = 0;
  }

  async open() {
    const connection = new TunnelConnection(this.opts);
    this.connections.add(connection);

    connection.on('open', this._handleTunnelOpen.bind(this));
    connection.on('dead', this._handleTunnelDead.bind(this));
    connection.on('error', this._handleTunnelError.bind(this));
    connection.on('request', req => this.emit('request', req));

    try {
      await connection.open();
    } catch (err) {
      this.connections.delete(connection);
      this.emit('error', err);
    }
  }

  _handleTunnelOpen() {
    this.openConnections++;
    debug('tunnel open [total: %d]', this.openConnections);
  }

  _handleTunnelError(err) {
    debug('got tunnel connection error', err.message);
    if (err.message.includes("ECONNREFUSED")) {
      this.close();
      this.emit('dead');
    } else {
      this.emit('error', err);
    }
  }

  _handleTunnelDead(connection) {
    this.connections.delete(connection);
    this.openConnections--;
    debug('tunnel dead [total: %d]', this.openConnections);
    this.open();
  }

  close() {
    for (const connection of this.connections) {
      connection.close();
    }
    this.connections.clear();
  }
}

module.exports = TunnelCluster;