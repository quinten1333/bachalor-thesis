#!/usr/bin/env node

/**
 * Module dependencies.
 */

import { connect, initSending } from '../../libraries/amqpmessaging/index.js';
import debugLib from 'debug';
import http from 'http';

const debug = debugLib('API_gateway:server');
let port, server;

const main = async () => {
  await connect();
  await initSending();
  debug('amqp initialized');

  // Import app after the messaging library is initialized
  // so that conn and channel are set when importing.
  const app = await (await import('./app.js')).default;

  port = normalizePort(process.env.PORT || '3000');
  app.set('port', port);

  server = http.createServer(app);

  server.listen(port);
  server.on('error', onError);
  server.on('listening', onListening);
};
main();

/**
 * Normalize a port into a number, string, or false.
 */
function normalizePort(val) {
  const normalizedPort = parseInt(val, 10);

  if (isNaN(normalizedPort)) {
    // named pipe
    return val;
  }

  if (normalizedPort >= 0) {
    // port number
    return normalizedPort;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */
function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */
function onListening() {
  const addr = server.address();
  const bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}
