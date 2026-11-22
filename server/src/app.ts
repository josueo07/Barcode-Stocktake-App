import cors from 'cors';
import express from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import type { AppDatabase } from './db/client';
import { env } from './config/env';
import { requireAuth } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { createAuthRouter } from './routes/auth.routes';
import { createHealthRouter } from './routes/health.routes';
import { createProductsRouter } from './routes/products.routes';
import { createScansRouter } from './routes/scans.routes';
import { createSessionsRouter } from './routes/sessions.routes';
import { createUsersRouter } from './routes/users.routes';

export interface AppDependencies {
  db: AppDatabase;
  /** Optional so tests can build the app without a live Socket.io server. */
  io?: SocketIOServer;
}

/** Builds the Express app without binding a port, so tests can exercise it via supertest directly. */
export function createApp({ db, io }: AppDependencies) {
  const app = express();

  app.use(cors({ origin: env.clientOrigins }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);

  // Public routes.
  app.use('/api/health', createHealthRouter());
  app.use('/api/auth', createAuthRouter(db));

  // Everything below requires a signed-in user; role checks live on the individual routes.
  const authenticated = requireAuth(db);
  app.use('/api/users', authenticated, createUsersRouter(db));
  app.use('/api/products', authenticated, createProductsRouter(db));
  app.use('/api/sessions', authenticated, createSessionsRouter(db, io));
  app.use('/api/sessions', authenticated, createScansRouter(db, io));

  app.use((_req, res) => {
    res.status(404).json({ error: { message: 'Not found' } });
  });

  app.use(errorHandler);

  return app;
}
