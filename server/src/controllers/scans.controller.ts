import type { RequestHandler } from 'express';
import { desc, eq } from 'drizzle-orm';
import type { Server as SocketIOServer } from 'socket.io';
import { MAX_BATCH_SCAN_SIZE, SOCKET_EVENTS, type ScanSubmission } from '@barcode-stocktake/shared';
import type { AppDatabase } from '../db/client';
import { scanEvents, stocktakeSessions } from '../db/schema';
import { AppError } from '../middleware/errorHandler';
import {
  countForBarcode,
  getLiveCounts,
  recordScan,
  recordScanBatch,
  type RecordScanResult,
} from '../services/scan.service';
import { buildVarianceReport, toCsv } from '../services/varianceReport.service';

function getSessionOrThrow(db: AppDatabase, id: number) {
  const session = db.select().from(stocktakeSessions).where(eq(stocktakeSessions.id, id)).get();
  if (!session) {
    throw new AppError(`Session ${id} not found`, 404);
  }
  return session;
}

function emitCountUpdate(io: SocketIOServer | undefined, sessionId: number, result: RecordScanResult) {
  io?.to(`session:${sessionId}`).emit(SOCKET_EVENTS.COUNT_UPDATE, {
    sessionId,
    productId: result.productId,
    barcode: result.scanEvent.barcode,
    newCount: result.newCount,
    lastScan: {
      clientScanId: result.scanEvent.clientScanId,
      scannedAt: result.scanEvent.scannedAt,
      deviceLabel: result.scanEvent.deviceLabel,
    },
  });
}

export function submitScan(db: AppDatabase, io?: SocketIOServer): RequestHandler {
  return (req, res, next) => {
    try {
      const id = Number(req.params.id);
      getSessionOrThrow(db, id);

      const submission = req.body as ScanSubmission;
      const result = recordScan(db, id, submission);
      if (result.status === 'accepted') {
        emitCountUpdate(io, id, result);
      }
      res.status(result.status === 'accepted' ? 201 : 200).json({ status: result.status });
    } catch (err) {
      next(err);
    }
  };
}

export function submitScanBatch(db: AppDatabase, io?: SocketIOServer): RequestHandler {
  return (req, res, next) => {
    try {
      const id = Number(req.params.id);
      getSessionOrThrow(db, id);

      const { scans } = req.body as { scans: ScanSubmission[] };
      if (scans.length > MAX_BATCH_SCAN_SIZE) {
        next(new AppError(`Batch too large (max ${MAX_BATCH_SCAN_SIZE} scans per request)`, 400));
        return;
      }

      const { results, accepted } = recordScanBatch(db, id, scans);
      accepted.forEach((result) => emitCountUpdate(io, id, result));
      res.json({ results });
    } catch (err) {
      next(err);
    }
  };
}

export function listScans(db: AppDatabase): RequestHandler {
  return (req, res, next) => {
    try {
      const id = Number(req.params.id);
      getSessionOrThrow(db, id);
      const scans = db
        .select()
        .from(scanEvents)
        .where(eq(scanEvents.sessionId, id))
        .orderBy(desc(scanEvents.scannedAt))
        .all();
      res.json({ scans });
    } catch (err) {
      next(err);
    }
  };
}

export function getCounts(db: AppDatabase): RequestHandler {
  return (req, res, next) => {
    try {
      const id = Number(req.params.id);
      getSessionOrThrow(db, id);
      res.json({ counts: getLiveCounts(db, id) });
    } catch (err) {
      next(err);
    }
  };
}

export function voidScan(db: AppDatabase, io?: SocketIOServer): RequestHandler {
  return (req, res, next) => {
    try {
      const id = Number(req.params.id);
      getSessionOrThrow(db, id);

      const scanId = Number(req.params.scanId);
      const deleted = db.delete(scanEvents).where(eq(scanEvents.id, scanId)).returning().get();
      if (!deleted) {
        next(new AppError(`Scan ${scanId} not found`, 404));
        return;
      }

      const newCount = countForBarcode(db, id, deleted.barcode);
      io?.to(`session:${id}`).emit(SOCKET_EVENTS.COUNT_UPDATE, {
        sessionId: id,
        productId: deleted.productId,
        barcode: deleted.barcode,
        newCount,
        lastScan: {
          clientScanId: deleted.clientScanId,
          scannedAt: deleted.scannedAt,
          deviceLabel: deleted.deviceLabel,
        },
      });

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}

export function getVarianceReport(db: AppDatabase): RequestHandler {
  return (req, res, next) => {
    try {
      const id = Number(req.params.id);
      getSessionOrThrow(db, id);
      res.json({ report: buildVarianceReport(db, id) });
    } catch (err) {
      next(err);
    }
  };
}

export function exportVarianceReport(db: AppDatabase): RequestHandler {
  return (req, res, next) => {
    try {
      const id = Number(req.params.id);
      getSessionOrThrow(db, id);

      const report = buildVarianceReport(db, id);
      const csv = toCsv(report);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="variance-report-session-${id}.csv"`);
      res.send(csv);
    } catch (err) {
      next(err);
    }
  };
}
