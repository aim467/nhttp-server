const assert = require('node:assert/strict');
const net = require('node:net');
const test = require('node:test');
const { createServer } = require('../lib/server');

function listen(server, port = 0) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close(error => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

test('uses the next available port when the default port is occupied', async () => {
  const occupiedServer = net.createServer();
  const occupiedPort = await listen(occupiedServer);
  const originalLog = console.log;
  let server;

  console.log = () => {};
  try {
    server = await createServer({
      port: occupiedPort,
      rootDir: process.cwd(),
      open: false,
      compress: false,
      cors: false,
      autoPort: true
    });

    assert.notEqual(server.address().port, occupiedPort);
    assert.ok(server.address().port > occupiedPort);
  } finally {
    console.log = originalLog;
    if (server) {
      await close(server);
    }
    await close(occupiedServer);
  }
});

test('rejects when an explicitly requested port is occupied', async () => {
  const occupiedServer = net.createServer();
  const occupiedPort = await listen(occupiedServer);
  const originalLog = console.log;

  console.log = () => {};
  try {
    await assert.rejects(
      createServer({
        port: occupiedPort,
        rootDir: process.cwd(),
        open: false,
        compress: false,
        cors: false,
        autoPort: false
      }),
      new RegExp(`端口 ${occupiedPort} 已被占用`)
    );
  } finally {
    console.log = originalLog;
    await close(occupiedServer);
  }
});
