import type { Server as SocketIOServer } from 'socket.io';
import { SOCKET_EVENTS } from '@barcode-stocktake/shared';
import type { AppDatabase } from '../db/client';
import { authenticateToken } from '../services/auth.service';
import { logger } from '../utils/logger';

/**
 * Registers session room join/leave handlers. All state-changing writes go through REST;
 * Socket.io here is purely server -> client fan-out (see docs/architecture.md).
 *
 * Every socket must present a valid login token in its handshake (`auth: { token }`);
 * connections without one are refused before they can join any session room.
 */
export function registerSessionSockets(io: SocketIOServer, db: AppDatabase): void {
  io.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
    const user = typeof token === 'string' ? authenticateToken(db, token) : null;
    if (!user) {
      next(new Error('Authentication required'));
      return;
    }
    socket.data.user = user;
    next();
  });

  io.on('connection', (socket) => {
    logger.debug({ socketId: socket.id, userId: socket.data.user?.id }, 'Socket connected');

    socket.on(SOCKET_EVENTS.JOIN_SESSION, (sessionId: unknown) => {
      if (!Number.isInteger(sessionId)) return;
      socket.join(`session:${sessionId as number}`);
      logger.debug({ socketId: socket.id, sessionId }, 'Socket joined session room');
    });

    socket.on(SOCKET_EVENTS.LEAVE_SESSION, (sessionId: unknown) => {
      if (!Number.isInteger(sessionId)) return;
      socket.leave(`session:${sessionId as number}`);
    });

    socket.on('disconnect', () => {
      logger.debug({ socketId: socket.id }, 'Socket disconnected');
    });
  });
}
