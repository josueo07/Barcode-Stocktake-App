import { Router } from 'express';
import { z } from 'zod';
import type { Server as SocketIOServer } from 'socket.io';
import type { AppDatabase } from '../db/client';
import { validateBody } from '../middleware/validateRequest';
import {
  exportVarianceReport,
  getCounts,
  getVarianceReport,
  submitScan,
  submitScanBatch,
  voidScan,
} from '../controllers/scans.controller';

const scanSubmissionSchema = z.object({
  clientScanId: z.string().uuid(),
  barcode: z.string().min(1),
  quantity: z.number().int().positive().optional(),
  scannedAt: z.string(),
  deviceLabel: z.string().optional(),
});

const batchScanSchema = z.object({
  scans: z.array(scanSubmissionSchema).min(1),
});

export function createScansRouter(db: AppDatabase, io?: SocketIOServer): Router {
  const router = Router();

  router.post('/:id/scans', validateBody(scanSubmissionSchema), submitScan(db, io));
  router.post('/:id/scans/batch', validateBody(batchScanSchema), submitScanBatch(db, io));
  router.get('/:id/counts', getCounts(db));
  router.delete('/:id/scans/:scanId', voidScan(db, io));
  router.get('/:id/variance-report', getVarianceReport(db));
  router.get('/:id/variance-report/export', exportVarianceReport(db));

  return router;
}
