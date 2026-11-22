import { Router } from 'express';
import { z } from 'zod';
import type { Server as SocketIOServer } from 'socket.io';
import type { AppDatabase } from '../db/client';
import { supervisorOnly } from '../middleware/auth';
import { validateBody } from '../middleware/validateRequest';
import {
  exportVarianceReport,
  acceptLate,
  getCounts,
  getLateScans,
  getVarianceReport,
  listScans,
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

const acceptLateSchema = z.object({
  scanIds: z.array(z.number().int().positive()).min(1).max(1000),
});

const batchScanSchema = z.object({
  scans: z.array(scanSubmissionSchema).min(1),
});

export function createScansRouter(db: AppDatabase, io?: SocketIOServer): Router {
  const router = Router();

  router.post('/:id/scans', validateBody(scanSubmissionSchema), submitScan(db, io));
  router.post('/:id/scans/batch', validateBody(batchScanSchema), submitScanBatch(db, io));
  router.get('/:id/scans', listScans(db));
  router.get('/:id/counts', getCounts(db));
  router.delete('/:id/scans/:scanId', supervisorOnly, voidScan(db, io));
  router.get('/:id/late-scans', supervisorOnly, getLateScans(db));
  router.post(
    '/:id/late-scans/accept',
    supervisorOnly,
    validateBody(acceptLateSchema),
    acceptLate(db, io),
  );
  router.get('/:id/variance-report', supervisorOnly, getVarianceReport(db));
  router.get('/:id/variance-report/export', supervisorOnly, exportVarianceReport(db));

  return router;
}
