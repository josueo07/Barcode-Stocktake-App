import cors from 'cors';
import express from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import type { AppDatabase } from './db/client';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { createHealthRouter } from './routes/health.routes';
import { createProductsRouter } from './routes/products.routes';
import { createScansRouter } from './routes/scans.routes';
import { createSessionsRouter } from './routes/sessions.routes';

export interface AppDependencies {
  db: AppDatabase;
  /** Optional so tests can build the app without a live Socket.io server. */
  io?: SocketIOServer;
}

/** Builds the Express app without binding a port, so tests can exercise it via supertest directly. */
export function createApp({ db, io }: AppDependencies) {
  const app = express();

  app.use(cors({ origin: env.clientOrigins }));
  app.use(express.json());
  app.use(requestLogger);

  app.use('/api/health', createHealthRouter());
  app.use('/api/products', createProductsRouter(db));
  app.use('/api/sessions', createSessionsRouter(db, io));
  app.use('/api/sessions', createScansRouter(db, io));

  app.use((_req, res) => {
    res.status(404).json({ error: { message: 'Not found' } });
  });

  app.use(errorHandler);

  return app;
}
