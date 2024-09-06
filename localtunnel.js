const Tunnel = require('./lib/Tunnel');

async function localtunnel(arg1, arg2, arg3) {
  const options = typeof arg1 === 'object' ? arg1 : { ...arg2, port: arg1 };
  const callback = typeof arg1 === 'object' ? arg2 : arg3;

  const client = new Tunnel(options);

  if (callback && typeof callback === 'function') {
    try {
      await client.open();
      callback(null, client);
    } catch (err) {
      callback(err);
    }
    return client;
  }

  await client.open();
  return client;
}

module.exports = localtunnel;