import type { VarianceReport, VarianceReportRow } from '@barcode-stocktake/shared';
import type { AppDatabase } from '../db/client';
import { varianceReportSnapshots } from '../db/schema';
import { getLiveCounts } from './scan.service';

export function buildVarianceReport(db: AppDatabase, sessionId: number): VarianceReport {
  const counts = getLiveCounts(db, sessionId);

  const rows: VarianceReportRow[] = counts.map((count) => ({
    productId: count.productId,
    sku: count.sku,
    barcode: count.barcode,
    name: count.name,
    expectedQty: count.expectedQty ?? 0,
    countedQty: count.countedQty,
    variance: count.countedQty - (count.expectedQty ?? 0),
  }));

  const totals = rows.reduce(
    (acc, row) => ({
      expectedQty: acc.expectedQty + row.expectedQty,
      countedQty: acc.countedQty + row.countedQty,
      variance: acc.variance + row.variance,
    }),
    { expectedQty: 0, countedQty: 0, variance: 0 },
  );

  return {
    sessionId,
    generatedAt: new Date().toISOString(),
    rows,
    totals,
  };
}

/** Freezes a variance report snapshot when a session completes, so later scan corrections don't rewrite history. */
export function persistVarianceReportSnapshot(db: AppDatabase, sessionId: number): VarianceReport {
  const report = buildVarianceReport(db, sessionId);
  db.insert(varianceReportSnapshots)
    .values({ sessionId, generatedAt: report.generatedAt, data: report })
    .run();
  return report;
}

export function toCsv(report: VarianceReport): string {
  const header = 'SKU,Barcode,Name,Expected Qty,Counted Qty,Variance';
  const lines = report.rows.map((row) =>
    [
      row.sku ?? '',
      row.barcode,
      (row.name ?? '').replace(/,/g, ' '),
      row.expectedQty,
      row.countedQty,
      row.variance,
    ].join(','),
  );
  return [header, ...lines].join('\n');
}
