import { beforeEach, describe, expect, it } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import type { AppDatabase } from '../../src/db/client';
import { stocktakeSessions } from '../../src/db/schema';
import { importCsv } from '../../src/services/csvImport.service';
import { recordScan } from '../../src/services/scan.service';
import { buildVarianceReport } from '../../src/services/varianceReport.service';
import { createTestDatabase } from '../testDb';

describe('buildVarianceReport', () => {
  let db: AppDatabase;
  let sessionId: number;

  beforeEach(() => {
    ({ db } = createTestDatabase());
    const session = db.insert(stocktakeSessions).values({ name: 'Test Session' }).returning().get();
    sessionId = session.id;
  });

  it('returns an empty report for a session with no expected quantities or scans', () => {
    const report = buildVarianceReport(db, sessionId);
    expect(report.rows).toHaveLength(0);
    expect(report.totals).toEqual({ expectedQty: 0, countedQty: 0, variance: 0 });
  });

  it('reports a negative variance when counted is less than expected', () => {
    importCsv(db, sessionId, Buffer.from('sku,barcode,name,expected_qty\nSKU1,1111111111111,Widget,10\n'));
    recordScan(db, sessionId, {
      clientScanId: uuidv4(),
      barcode: '1111111111111',
      scannedAt: new Date().toISOString(),
    });

    const report = buildVarianceReport(db, sessionId);
    expect(report.rows[0]).toMatchObject({ expectedQty: 10, countedQty: 1, variance: -9 });
  });

  it('treats a scanned barcode with no matching expected quantity as an unexpected surplus', () => {
    recordScan(db, sessionId, {
      clientScanId: uuidv4(),
      barcode: '9999999999999',
      scannedAt: new Date().toISOString(),
    });

    const report = buildVarianceReport(db, sessionId);
    expect(report.rows[0]).toMatchObject({ barcode: '9999999999999', expectedQty: 0, countedQty: 1, variance: 1 });
  });

  it('treats an expected product with zero scans as a full shortfall', () => {
    importCsv(db, sessionId, Buffer.from('sku,barcode,name,expected_qty\nSKU1,1111111111111,Widget,5\n'));

    const report = buildVarianceReport(db, sessionId);
    expect(report.rows[0]).toMatchObject({ expectedQty: 5, countedQty: 0, variance: -5 });
  });

  it('sums variance correctly across multiple products in the totals', () => {
    importCsv(
      db,
      sessionId,
      Buffer.from(
        'sku,barcode,name,expected_qty\nSKU1,1111111111111,Widget,10\nSKU2,2222222222222,Gadget,4\n',
      ),
    );
    recordScan(db, sessionId, {
      clientScanId: uuidv4(),
      barcode: '1111111111111',
      scannedAt: new Date().toISOString(),
    });
    recordScan(db, sessionId, {
      clientScanId: uuidv4(),
      barcode: '2222222222222',
      scannedAt: new Date().toISOString(),
    });

    const report = buildVarianceReport(db, sessionId);
    expect(report.totals).toEqual({ expectedQty: 14, countedQty: 2, variance: -12 });
  });
});
