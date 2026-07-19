import { parse } from 'csv-parse/sync';
import { eq } from 'drizzle-orm';
import type { CsvImportSummary } from '@barcode-stocktake/shared';
import type { AppDatabase } from '../db/client';
import { products, sessionExpectedQuantities } from '../db/schema';

interface CsvRow {
  sku?: string;
  barcode?: string;
  name?: string;
  expected_qty?: string;
  category?: string;
}

/**
 * Imports a CSV of expected quantities for a stocktake session. Expects a header row with
 * columns: sku, barcode, name, expected_qty, and an optional category column.
 * Upserts the product catalog by barcode and writes session-scoped expected quantities.
 */
export function importCsv(
  db: AppDatabase,
  sessionId: number,
  fileBuffer: Buffer,
): CsvImportSummary {
  const summary: CsvImportSummary = {
    productsCreated: 0,
    productsUpdated: 0,
    expectedQuantitiesWritten: 0,
    rowsSkipped: 0,
    errors: [],
  };

  let records: CsvRow[];
  try {
    records = parse(fileBuffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CsvRow[];
  } catch (err) {
    summary.errors.push({ row: 0, message: `Failed to parse CSV: ${(err as Error).message}` });
    return summary;
  }

  records.forEach((row, index) => {
    const rowNumber = index + 2; // +1 for header row, +1 for 1-based indexing
    const sku = row.sku?.trim();
    const barcode = row.barcode?.trim();
    const name = row.name?.trim();
    const expectedQtyRaw = row.expected_qty?.trim();
    const category = row.category?.trim() || null;

    if (!sku || !barcode || !name || !expectedQtyRaw) {
      summary.rowsSkipped += 1;
      summary.errors.push({
        row: rowNumber,
        message: 'Missing required column (sku, barcode, name, expected_qty)',
      });
      return;
    }

    const expectedQty = Number(expectedQtyRaw);
    if (!Number.isInteger(expectedQty) || expectedQty < 0) {
      summary.rowsSkipped += 1;
      summary.errors.push({
        row: rowNumber,
        message: `Invalid expected_qty "${expectedQtyRaw}" (must be a non-negative integer)`,
      });
      return;
    }

    const existingProduct = db.select().from(products).where(eq(products.barcode, barcode)).get();

    let productId: number;
    if (existingProduct) {
      db.update(products)
        .set({ sku, name, category, updatedAt: new Date().toISOString() })
        .where(eq(products.id, existingProduct.id))
        .run();
      productId = existingProduct.id;
      summary.productsUpdated += 1;
    } else {
      const inserted = db.insert(products).values({ sku, barcode, name, category }).returning().get();
      productId = inserted.id;
      summary.productsCreated += 1;
    }

    db.insert(sessionExpectedQuantities)
      .values({ sessionId, productId, expectedQty, source: 'csv_import' })
      .onConflictDoUpdate({
        target: [sessionExpectedQuantities.sessionId, sessionExpectedQuantities.productId],
        set: { expectedQty, source: 'csv_import', updatedAt: new Date().toISOString() },
      })
      .run();

    summary.expectedQuantitiesWritten += 1;
  });

  return summary;
}
