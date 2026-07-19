import { beforeEach, describe, expect, it } from 'vitest';
import type { AppDatabase } from '../../src/db/client';
import { stocktakeSessions } from '../../src/db/schema';
import { importCsv } from '../../src/services/csvImport.service';
import { createTestDatabase } from '../testDb';

describe('importCsv', () => {
  let db: AppDatabase;
  let sessionId: number;

  beforeEach(() => {
    ({ db } = createTestDatabase());
    const session = db.insert(stocktakeSessions).values({ name: 'Test Session' }).returning().get();
    sessionId = session.id;
  });

  it('imports valid rows, creating a product and its expected quantity', () => {
    const csv = 'sku,barcode,name,expected_qty\nSKU1,1111111111111,Widget,10\n';
    const summary = importCsv(db, sessionId, Buffer.from(csv));

    expect(summary).toMatchObject({
      productsCreated: 1,
      productsUpdated: 0,
      expectedQuantitiesWritten: 1,
      rowsSkipped: 0,
    });
    expect(summary.errors).toHaveLength(0);
  });

  it('skips a row missing a required column and records why', () => {
    const csv = 'sku,barcode,name,expected_qty\n,1111111111111,Widget,10\n';
    const summary = importCsv(db, sessionId, Buffer.from(csv));

    expect(summary.rowsSkipped).toBe(1);
    expect(summary.expectedQuantitiesWritten).toBe(0);
    expect(summary.errors[0].message).toMatch(/missing required column/i);
  });

  it('skips rows with a non-integer or negative expected_qty', () => {
    const csv =
      'sku,barcode,name,expected_qty\n' +
      'SKU1,1111111111111,Widget,-5\n' +
      'SKU2,2222222222222,Gadget,abc\n';
    const summary = importCsv(db, sessionId, Buffer.from(csv));

    expect(summary.rowsSkipped).toBe(2);
    expect(summary.errors).toHaveLength(2);
    expect(summary.expectedQuantitiesWritten).toBe(0);
  });

  it('matches an existing product by barcode and updates it instead of duplicating', () => {
    importCsv(db, sessionId, Buffer.from('sku,barcode,name,expected_qty\nSKU1,1111111111111,Old Name,10\n'));
    const summary = importCsv(
      db,
      sessionId,
      Buffer.from('sku,barcode,name,expected_qty\nSKU1,1111111111111,New Name,20\n'),
    );

    expect(summary.productsCreated).toBe(0);
    expect(summary.productsUpdated).toBe(1);
  });

  it('re-importing the same barcode for a session updates the expected quantity rather than erroring', () => {
    importCsv(db, sessionId, Buffer.from('sku,barcode,name,expected_qty\nSKU1,1111111111111,Widget,10\n'));
    const summary = importCsv(
      db,
      sessionId,
      Buffer.from('sku,barcode,name,expected_qty\nSKU1,1111111111111,Widget,25\n'),
    );

    expect(summary.expectedQuantitiesWritten).toBe(1);
    expect(summary.errors).toHaveLength(0);
  });
});
