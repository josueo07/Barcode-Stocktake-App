import type { Server as SocketIOServer } from 'socket.io';
import { SOCKET_EVENTS } from '@barcode-stocktake/shared';
import { logger } from '../utils/logger';

/**
 * Registers session room join/leave handlers. All state-changing writes go through REST;
 * Socket.io here is purely server -> client fan-out (see docs/architecture.md).
 */
export function registerSessionSockets(io: SocketIOServer): void {
  io.on('connection', (socket) => {
    logger.debug({ socketId: socket.id }, 'Socket connected');

    socket.on(SOCKET_EVENTS.JOIN_SESSION, (sessionId: number) => {
      socket.join(`session:${sessionId}`);
      logger.debug({ socketId: socket.id, sessionId }, 'Socket joined session room');
    });

    socket.on(SOCKET_EVENTS.LEAVE_SESSION, (sessionId: number) => {
      socket.leave(`session:${sessionId}`);
    });

    socket.on('disconnect', () => {
      logger.debug({ socketId: socket.id }, 'Socket disconnected');
    });
  });
}
