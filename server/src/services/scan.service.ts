import { and, eq, inArray, sql } from 'drizzle-orm';
import type {
  BatchScanItemResult,
  LiveCount,
  ScanSubmission,
  SessionStatus,
} from '@barcode-stocktake/shared';
import type { AppDatabase } from '../db/client';
import { products, scanEvents, sessionExpectedQuantities, stocktakeSessions } from '../db/schema';
import { AppError } from '../middleware/errorHandler';

type ScanEventRow = typeof scanEvents.$inferSelect;

export interface RecordScanResult {
  status: 'accepted' | 'duplicate' | 'late';
  scanEvent: ScanEventRow;
  productId: number | null;
  newCount: number;
}

/**
 * Decides, from the session's current status, whether a newly arriving scan counts:
 * - draft: rejected (the count hasn't started),
 * - active: counted,
 * - completed: stored as late for supervisor review, never silently added to a closed count.
 * Reading the status inside the same synchronous call as the insert means a scan can't slip
 * in between "closed" being written and the scan being recorded.
 */
function scanDisposition(db: AppDatabase, sessionId: number): { late: boolean } {
  const session = db
    .select({ status: stocktakeSessions.status })
    .from(stocktakeSessions)
    .where(eq(stocktakeSessions.id, sessionId))
    .get();
  if (!session) throw new AppError(`Session ${sessionId} not found`, 404);
  const status: SessionStatus = session.status;
  if (status === 'draft') {
    throw new AppError('This count has not started yet. Ask a supervisor to start it.', 409);
  }
  return { late: status === 'completed' };
}

/**
 * Records a single scan, deduping on (sessionId, clientScanId) so retried offline-sync
 * submissions of the same physical scan are safe no-ops rather than double counts.
 */
export function recordScan(
  db: AppDatabase,
  sessionId: number,
  submission: ScanSubmission,
  userId: number | null = null,
): RecordScanResult {
  const existing = db
    .select()
    .from(scanEvents)
    .where(
      and(
        eq(scanEvents.sessionId, sessionId),
        eq(scanEvents.clientScanId, submission.clientScanId),
      ),
    )
    .get();

  if (existing) {
    return {
      status: 'duplicate',
      scanEvent: existing,
      productId: existing.productId,
      newCount: countForBarcode(db, sessionId, existing.barcode),
    };
  }

  const { late } = scanDisposition(db, sessionId);
  const product = db.select().from(products).where(eq(products.barcode, submission.barcode)).get();

  const inserted = db
    .insert(scanEvents)
    .values({
      sessionId,
      productId: product?.id ?? null,
      barcode: submission.barcode,
      clientScanId: submission.clientScanId,
      deviceLabel: submission.deviceLabel ?? null,
      userId,
      late,
      quantity: submission.quantity ?? 1,
      scannedAt: submission.scannedAt,
    })
    .returning()
    .get();

  return {
    status: late ? 'late' : 'accepted',
    scanEvent: inserted,
    productId: inserted.productId,
    newCount: countForBarcode(db, sessionId, submission.barcode),
  };
}

export function recordScanBatch(
  db: AppDatabase,
  sessionId: number,
  submissions: ScanSubmission[],
  userId: number | null = null,
): { results: BatchScanItemResult[]; accepted: RecordScanResult[] } {
  const results: BatchScanItemResult[] = [];
  const accepted: RecordScanResult[] = [];

  for (const submission of submissions) {
    try {
      const result = recordScan(db, sessionId, submission, userId);
      results.push({ clientScanId: submission.clientScanId, status: result.status });
      if (result.status === 'accepted') {
        accepted.push(result);
      }
    } catch (err) {
      results.push({
        clientScanId: submission.clientScanId,
        status: 'error',
        error: (err as Error).message,
      });
    }
  }

  return { results, accepted };
}

export function countForBarcode(db: AppDatabase, sessionId: number, barcode: string): number {
  const row = db
    .select({ total: sql<number>`coalesce(sum(${scanEvents.quantity}), 0)` })
    .from(scanEvents)
    .where(
      and(
        eq(scanEvents.sessionId, sessionId),
        eq(scanEvents.barcode, barcode),
        eq(scanEvents.late, false),
      ),
    )
    .get();
  return row?.total ?? 0;
}

/** Live per-product counts for a session: expected quantity (if any) joined with counted-so-far. */
export function getLiveCounts(db: AppDatabase, sessionId: number): LiveCount[] {
  const countRows = db
    .select({
      barcode: scanEvents.barcode,
      productId: scanEvents.productId,
      countedQty: sql<number>`coalesce(sum(${scanEvents.quantity}), 0)`,
    })
    .from(scanEvents)
    .where(and(eq(scanEvents.sessionId, sessionId), eq(scanEvents.late, false)))
    .groupBy(scanEvents.barcode, scanEvents.productId)
    .all();

  const expectedRows = db
    .select({
      productId: sessionExpectedQuantities.productId,
      expectedQty: sessionExpectedQuantities.expectedQty,
      sku: products.sku,
      barcode: products.barcode,
      name: products.name,
    })
    .from(sessionExpectedQuantities)
    .innerJoin(products, eq(sessionExpectedQuantities.productId, products.id))
    .where(eq(sessionExpectedQuantities.sessionId, sessionId))
    .all();

  const byBarcode = new Map<string, LiveCount>();

  for (const row of expectedRows) {
    byBarcode.set(row.barcode, {
      productId: row.productId,
      barcode: row.barcode,
      sku: row.sku,
      name: row.name,
      expectedQty: row.expectedQty,
      countedQty: 0,
    });
  }

  for (const row of countRows) {
    const existing = byBarcode.get(row.barcode);
    if (existing) {
      existing.countedQty = row.countedQty;
    } else {
      byBarcode.set(row.barcode, {
        productId: row.productId,
        barcode: row.barcode,
        sku: null,
        name: null,
        expectedQty: null,
        countedQty: row.countedQty,
      });
    }
  }

  return Array.from(byBarcode.values()).sort((a, b) => a.barcode.localeCompare(b.barcode));
}

/** Late scans for a session, newest first, for the supervisor's review list. */
export function listLateScans(db: AppDatabase, sessionId: number) {
  return db
    .select()
    .from(scanEvents)
    .where(and(eq(scanEvents.sessionId, sessionId), eq(scanEvents.late, true)))
    .orderBy(scanEvents.scannedAt)
    .all();
}

/** Moves the given late scans into the count. Returns how many were accepted. */
export function acceptLateScans(db: AppDatabase, sessionId: number, scanIds: number[]): number {
  if (scanIds.length === 0) return 0;
  return db
    .update(scanEvents)
    .set({ late: false })
    .where(
      and(
        eq(scanEvents.sessionId, sessionId),
        eq(scanEvents.late, true),
        inArray(scanEvents.id, scanIds),
      ),
    )
    .run().changes;
}
