import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
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
  if (!session) throw new AppError(`Conteo ${sessionId} no encontrado (not found)`, 404);
  const status: SessionStatus = session.status;
  if (status === 'draft') {
    throw new AppError('Este conteo no ha empezado. Pide a un supervisor que lo inicie.', 409);
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
      newCount: countForScan(db, sessionId, existing.productId, existing.barcode),
    };
  }

  const { late } = scanDisposition(db, sessionId);
  const product =
    findProductByBarcode(db, submission.barcode) ??
    createProductFromScan(db, submission.barcode, submission.newProductName);

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
      lot: submission.lot ?? null,
      expiryDate: submission.expiryDate ?? null,
      unitCostCents: submission.unitCostCents ?? null,
      quantity: submission.quantity ?? 1,
      scannedAt: submission.scannedAt,
    })
    .returning()
    .get();

  return {
    status: late ? 'late' : 'accepted',
    scanEvent: inserted,
    productId: inserted.productId,
    newCount: countForScan(db, sessionId, inserted.productId, submission.barcode),
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

/**
 * Counted total for the product a scan belongs to (all of its barcode forms, e.g. with or
 * without a leading zero), or for the raw barcode when the product is unknown.
 */
export function countForScan(
  db: AppDatabase,
  sessionId: number,
  productId: number | null,
  barcode: string,
): number {
  const row = db
    .select({ total: sql<number>`coalesce(sum(${scanEvents.quantity}), 0)` })
    .from(scanEvents)
    .where(
      and(
        eq(scanEvents.sessionId, sessionId),
        productId !== null
          ? eq(scanEvents.productId, productId)
          : and(isNull(scanEvents.productId), eq(scanEvents.barcode, barcode)),
        eq(scanEvents.late, false),
      ),
    )
    .get();
  return row?.total ?? 0;
}

/** Strips leading zeros so UPC-A (12 digits) and EAN-13 (leading 0) forms of a code match. */
export function barcodeKey(barcode: string): string {
  const trimmed = barcode.trim();
  return /^\d+$/.test(trimmed) ? trimmed.replace(/^0+(?=\d)/, '') : trimmed;
}

/**
 * Finds a product by exact barcode, or by the same digits with different leading zeros
 * (the pharmacy's file may list "0300450123456" while the scanner reads "300450123456").
 */
export function findProductByBarcode(db: AppDatabase, barcode: string) {
  const exact = db.select().from(products).where(eq(products.barcode, barcode)).get();
  if (exact) return exact;
  const key = barcodeKey(barcode);
  if (!/^\d+$/.test(key)) return undefined;
  return db
    .select()
    .from(products)
    .where(sql`ltrim(${products.barcode}, '0') = ${key}`)
    .get();
}

/**
 * A product that wasn't in the pharmacy's file, created on the spot from the name the counter
 * typed. Its SKU is the barcode (or barcode-suffixed if that SKU is already taken).
 */
function createProductFromScan(db: AppDatabase, barcode: string, name?: string) {
  const trimmed = name?.trim();
  if (!trimmed) return undefined;
  let sku = barcode;
  for (let n = 2; db.select().from(products).where(eq(products.sku, sku)).get(); n += 1) {
    sku = `${barcode}-${n}`;
  }
  const created = db.insert(products).values({ sku, barcode, name: trimmed }).returning().get();
  // Earlier scans of this code (before anyone typed a name) now belong to the new product.
  db.update(scanEvents)
    .set({ productId: created.id })
    .where(and(eq(scanEvents.barcode, barcode), isNull(scanEvents.productId)))
    .run();
  return created;
}

/** Live per-product counts for a session: expected quantity (if any) joined with counted-so-far. */
export function getLiveCounts(db: AppDatabase, sessionId: number): LiveCount[] {
  const countRows = db
    .select({
      barcode: scanEvents.barcode,
      productId: scanEvents.productId,
      sku: products.sku,
      name: products.name,
      productBarcode: products.barcode,
      countedQty: sql<number>`coalesce(sum(${scanEvents.quantity}), 0)`,
    })
    .from(scanEvents)
    .leftJoin(products, eq(scanEvents.productId, products.id))
    .where(and(eq(scanEvents.sessionId, sessionId), eq(scanEvents.late, false)))
    .groupBy(scanEvents.barcode, scanEvents.productId)
    .all();

  const expectedRows = db
    .select({
      productId: sessionExpectedQuantities.productId,
      expectedQty: sessionExpectedQuantities.expectedQty,
      unitCostCents: sessionExpectedQuantities.unitCostCents,
      sku: products.sku,
      barcode: products.barcode,
      name: products.name,
    })
    .from(sessionExpectedQuantities)
    .innerJoin(products, eq(sessionExpectedQuantities.productId, products.id))
    .where(eq(sessionExpectedQuantities.sessionId, sessionId))
    .all();

  // Known products are keyed by id (a scan may use a different leading-zero form of the
  // barcode); unknown scans by their barcode.
  const byKey = new Map<string, LiveCount>();

  for (const row of expectedRows) {
    byKey.set(`p${row.productId}`, {
      productId: row.productId,
      barcode: row.barcode,
      sku: row.sku,
      name: row.name,
      expectedQty: row.expectedQty,
      expectedUnitCostCents: row.unitCostCents ?? null,
      countedQty: 0,
    });
  }

  for (const row of countRows) {
    const key = row.productId !== null ? `p${row.productId}` : `b${row.barcode}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.countedQty += row.countedQty;
    } else {
      byKey.set(key, {
        productId: row.productId,
        barcode: row.productBarcode ?? row.barcode,
        sku: row.sku ?? null,
        name: row.name ?? null,
        expectedQty: null,
        expectedUnitCostCents: null,
        countedQty: row.countedQty,
      });
    }
  }

  return Array.from(byKey.values()).sort((a, b) => a.barcode.localeCompare(b.barcode));
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
