import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { Server as SocketIOServer } from 'socket.io';
import type { AppDatabase } from '../db/client';
import { validateBody } from '../middleware/validateRequest';
import {
  addManualExpectedQuantity,
  createSession,
  getSession,
  importSessionCsv,
  listExpectedQuantities,
  listSessions,
  updateSession,
} from '../controllers/sessions.controller';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const createSessionSchema = z.object({
  name: z.string().min(1),
  notes: z.string().nullable().optional(),
});

const updateSessionSchema = z.object({
  name: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(['draft', 'active', 'completed']).optional(),
});

const manualExpectedQtySchema = z.object({
  barcode: z.string().min(1),
  expectedQty: z.number().int().nonnegative(),
  name: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
});

export function createSessionsRouter(db: AppDatabase, io?: SocketIOServer): Router {
  const router = Router();

  router.get('/', listSessions(db));
  router.post('/', validateBody(createSessionSchema), createSession(db));
  router.get('/:id', getSession(db));
  router.patch('/:id', validateBody(updateSessionSchema), updateSession(db, io));

  router.post('/:id/import-csv', upload.single('file'), importSessionCsv(db, io));
  router.get('/:id/expected-quantities', listExpectedQuantities(db));
  router.post(
    '/:id/expected-quantities',
    validateBody(manualExpectedQtySchema),
    addManualExpectedQuantity(db, io),
  );

  return router;
}
