const { EventEmitter } = require('events');
const TunnelConnection = require('./TunnelConnection');

class TunnelCluster extends EventEmitter {
  constructor(opts = {}) {
    super(opts);
    this.opts = opts;
    this.connections = new Set();
  }

  async open() {
    const connection = new TunnelConnection(this.opts);
    this.connections.add(connection);

    connection.on('open', remote => this.emit('open', remote));
    connection.on('dead', () => {
      this.connections.delete(connection);
      this.emit('dead');
    });
    connection.on('error', err => this.emit('error', err));
    connection.on('request', req => this.emit('request', req));

    try {
      await connection.open();
    } catch (err) {
      this.connections.delete(connection);
      throw err;
    }
  }

  close() {
    for (const connection of this.connections) {
      connection.close();
    }
    this.connections.clear();
  }
}

module.exports = TunnelCluster;