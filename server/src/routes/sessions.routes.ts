import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { Server as SocketIOServer } from 'socket.io';
import type { AppDatabase } from '../db/client';
import { supervisorOnly } from '../middleware/auth';
import { validateBody } from '../middleware/validateRequest';
import {
  addManualExpectedQuantity,
  createSession,
  deleteExpectedQuantity,
  deleteSession,
  getSession,
  importSessionCsv,
  listExpectedQuantities,
  listSessions,
  updateSession,
} from '../controllers/sessions.controller';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const createSessionSchema = z.object({
  name: z.string().min(1),
  notes: z.string().nullable().optional(),
  costEnabled: z.boolean().optional(),
});

const updateSessionSchema = z.object({
  name: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(['draft', 'active', 'completed']).optional(),
  costEnabled: z.boolean().optional(),
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
  router.post('/', supervisorOnly, validateBody(createSessionSchema), createSession(db));
  router.get('/:id', getSession(db));
  router.patch('/:id', supervisorOnly, validateBody(updateSessionSchema), updateSession(db, io));
  router.delete('/:id', supervisorOnly, deleteSession(db));

  router.post('/:id/import-csv', supervisorOnly, upload.single('file'), importSessionCsv(db, io));
  router.get('/:id/expected-quantities', listExpectedQuantities(db));
  router.post(
    '/:id/expected-quantities',
    supervisorOnly,
    validateBody(manualExpectedQtySchema),
    addManualExpectedQuantity(db, io),
  );
  router.delete(
    '/:id/expected-quantities/:productId',
    supervisorOnly,
    deleteExpectedQuantity(db, io),
  );

  return router;
}
