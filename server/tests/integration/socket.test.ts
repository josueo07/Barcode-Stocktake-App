import type { AddressInfo } from 'node:net';
import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { SOCKET_EVENTS, type CountUpdatePayload } from '@barcode-stocktake/shared';
import { createApp } from '../../src/app';
import { stocktakeSessions } from '../../src/db/schema';
import { registerSessionSockets } from '../../src/sockets/sessionNamespace';
import { createTestDatabase } from '../testDb';

describe('Socket.io live count broadcast', () => {
  let httpServer: http.Server;
  let clientSocket: ClientSocket;

  afterEach(() => {
    clientSocket?.close();
    httpServer?.close();
  });

  it('broadcasts session:count-update to clients in the session room after a scan is submitted', async () => {
    const { db } = createTestDatabase();
    const io = new SocketIOServer();
    const app = createApp({ db, io });

    httpServer = http.createServer(app);
    io.attach(httpServer);
    registerSessionSockets(io);

    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const port = (httpServer.address() as AddressInfo).port;

    clientSocket = ioClient(`http://localhost:${port}`, { transports: ['websocket'] });
    await new Promise<void>((resolve) => clientSocket.on('connect', () => resolve()));

    const session = db.insert(stocktakeSessions).values({ name: 'Socket Test' }).returning().get();

    clientSocket.emit(SOCKET_EVENTS.JOIN_SESSION, session.id);
    // Give the server a moment to process the room join before triggering the broadcast.
    await new Promise((resolve) => setTimeout(resolve, 50));

    const updateReceived = new Promise<CountUpdatePayload>((resolve) => {
      clientSocket.once(SOCKET_EVENTS.COUNT_UPDATE, resolve);
    });

    await request(httpServer)
      .post(`/api/sessions/${session.id}/scans`)
      .send({
        clientScanId: '55555555-5555-4555-8555-555555555555',
        barcode: '1234567890123',
        scannedAt: new Date().toISOString(),
      });

    const payload = await updateReceived;
    expect(payload).toMatchObject({ sessionId: session.id, barcode: '1234567890123', newCount: 1 });
  });
});
