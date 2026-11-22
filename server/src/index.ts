import http from 'node:http';
import os from 'node:os';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app';
import { env } from './config/env';
import { createDatabase } from './db/client';
import { registerSessionSockets } from './sockets/sessionNamespace';
import { logger } from './utils/logger';

const { db } = createDatabase(env.databasePath);

// The Express app needs `io` to emit events from route handlers, and Socket.io needs an
// http.Server to attach to — so the plain http server is created first with no handler,
// and the Express app is wired in afterwards via the 'request' event.
const httpServer = http.createServer();
const io = new SocketIOServer(httpServer, { cors: { origin: env.clientOrigins } });
registerSessionSockets(io, db);

const app = createApp({ db, io });
httpServer.on('request', app);

httpServer.listen(env.port, () => {
  logger.info(`Server listening on http://localhost:${env.port}`);

  const lanAddresses = Object.values(os.networkInterfaces())
    .flat()
    .filter(
      (iface): iface is os.NetworkInterfaceInfo =>
        !!iface && iface.family === 'IPv4' && !iface.internal,
    )
    .map((iface) => iface.address);

  if (lanAddresses.length > 0) {
    logger.info('On your phone (same WiFi network), open one of:');
    lanAddresses.forEach((addr) => logger.info(`  http://${addr}:${env.port}`));
  }
});

process.on('SIGTERM', () => httpServer.close());
process.on('SIGINT', () => httpServer.close());
