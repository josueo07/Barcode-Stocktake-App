import { and, eq, sql } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import type { VarianceReport, VarianceReportRow } from '@barcode-stocktake/shared';
import type { AppDatabase } from '../db/client';
import {
  products,
  scanEvents,
  stocktakeSessions,
  users,
  varianceReportSnapshots,
} from '../db/schema';
import { env } from '../config/env';
import { getLiveCounts } from './scan.service';

/** "2026-11-22 10:43" in the store's time zone, so the Excel file matches the wall clock. */
function localDateTime(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: env.storeTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

/**
 * Per product (or per barcode for unknown products): value of scans that carry a typed cost,
 * and the quantity of scans that don't (valued later at the imported cost).
 */
function scanCostTotals(db: AppDatabase, sessionId: number) {
  const rows = db
    .select({
      productId: scanEvents.productId,
      barcode: scanEvents.barcode,
      typedValue: sql<
        number | null
      >`sum(case when ${scanEvents.unitCostCents} is not null then ${scanEvents.quantity} * ${scanEvents.unitCostCents} end)`,
      uncostedQty: sql<number>`coalesce(sum(case when ${scanEvents.unitCostCents} is null then ${scanEvents.quantity} end), 0)`,
    })
    .from(scanEvents)
    .where(and(eq(scanEvents.sessionId, sessionId), eq(scanEvents.late, false)))
    .groupBy(scanEvents.productId, scanEvents.barcode)
    .all();
  const totals = new Map<string, { typedValue: number | null; uncostedQty: number }>();
  for (const row of rows) {
    const key = row.productId !== null ? `p${row.productId}` : `b${row.barcode}`;
    const prev = totals.get(key) ?? { typedValue: null, uncostedQty: 0 };
    totals.set(key, {
      typedValue:
        row.typedValue === null ? prev.typedValue : (prev.typedValue ?? 0) + row.typedValue,
      uncostedQty: prev.uncostedQty + row.uncostedQty,
    });
  }
  return totals;
}

const addNullable = (a: number | null, b: number | null) =>
  a === null && b === null ? null : (a ?? 0) + (b ?? 0);

export function buildVarianceReport(db: AppDatabase, sessionId: number): VarianceReport {
  const counts = getLiveCounts(db, sessionId);
  const session = db
    .select({ costEnabled: stocktakeSessions.costEnabled })
    .from(stocktakeSessions)
    .where(eq(stocktakeSessions.id, sessionId))
    .get();
  const scanCosts = scanCostTotals(db, sessionId);

  const rows: VarianceReportRow[] = counts.map((count) => {
    const expectedQty = count.expectedQty ?? 0;
    const unitCost = count.expectedUnitCostCents;
    const key = count.productId !== null ? `p${count.productId}` : `b${count.barcode}`;
    const costs = scanCosts.get(key) ?? { typedValue: null, uncostedQty: 0 };

    const expectedValueCents = unitCost === null ? null : expectedQty * unitCost;
    let countedValueCents: number | null;
    if (unitCost !== null) {
      countedValueCents = (costs.typedValue ?? 0) + costs.uncostedQty * unitCost;
    } else {
      countedValueCents = costs.typedValue;
    }
    const valueVarianceCents =
      expectedValueCents === null && countedValueCents === null
        ? null
        : (countedValueCents ?? 0) - (expectedValueCents ?? 0);

    return {
      productId: count.productId,
      sku: count.sku,
      barcode: count.barcode,
      name: count.name,
      expectedQty,
      countedQty: count.countedQty,
      variance: count.countedQty - expectedQty,
      unitCostCents: unitCost,
      expectedValueCents,
      countedValueCents,
      valueVarianceCents,
    };
  });

  const totals = rows.reduce(
    (acc, row) => ({
      expectedQty: acc.expectedQty + row.expectedQty,
      countedQty: acc.countedQty + row.countedQty,
      variance: acc.variance + row.variance,
      expectedValueCents: addNullable(acc.expectedValueCents, row.expectedValueCents),
      countedValueCents: addNullable(acc.countedValueCents, row.countedValueCents),
      valueVarianceCents: addNullable(acc.valueVarianceCents, row.valueVarianceCents),
    }),
    {
      expectedQty: 0,
      countedQty: 0,
      variance: 0,
      expectedValueCents: null as number | null,
      countedValueCents: null as number | null,
      valueVarianceCents: null as number | null,
    },
  );

  const anyCostKnown = rows.some(
    (r) => r.expectedValueCents !== null || r.countedValueCents !== null,
  );

  return {
    sessionId,
    generatedAt: new Date().toISOString(),
    costEnabled: (session?.costEnabled ?? false) || anyCostKnown,
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

/**
 * Makes a text cell safe for spreadsheets: values starting with = + - @ (or tab/CR) would
 * otherwise run as formulas when the file is opened in Excel.
 */
export function safeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvField(value: string | number | null): string {
  if (value === null) return '';
  // Plain numbers (including negative amounts like -7.50) are data, not formulas.
  if (typeof value === 'number' || /^-?\d+(\.\d+)?$/.test(value)) return String(value);
  const safe = safeCell(value);
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const centsToAmount = (cents: number | null) => (cents === null ? null : cents / 100);

const money = (cents: number | null) => (cents === null ? null : (cents / 100).toFixed(2));

export function toCsv(report: VarianceReport): string {
  const header = ['SKU', 'Código', 'Producto', 'Esperado', 'Contado', 'Diferencia'];
  if (report.costEnabled) {
    header.push('Costo unitario', 'Valor esperado', 'Valor contado', 'Diferencia en valor');
  }
  const lines = report.rows.map((row) => {
    const cells: (string | number | null)[] = [
      row.sku ?? '',
      row.barcode,
      row.name ?? '',
      row.expectedQty,
      row.countedQty,
      row.variance,
    ];
    if (report.costEnabled) {
      cells.push(
        money(row.unitCostCents),
        money(row.expectedValueCents),
        money(row.countedValueCents),
        money(row.valueVarianceCents),
      );
    }
    return cells.map(csvField).join(',');
  });
  // BOM so Excel opens accents (Código, Diferencia…) correctly.
  return '\ufeff' + [header.join(','), ...lines].join('\r\n');
}

/** Every counted scan with who, where and the optional pharmacy details, for the Excel detail sheet. */
export function listScanDetail(db: AppDatabase, sessionId: number) {
  return db
    .select({
      scannedAt: scanEvents.scannedAt,
      barcode: scanEvents.barcode,
      sku: products.sku,
      name: products.name,
      quantity: scanEvents.quantity,
      lot: scanEvents.lot,
      expiryDate: scanEvents.expiryDate,
      unitCostCents: scanEvents.unitCostCents,
      person: users.displayName,
      deviceLabel: scanEvents.deviceLabel,
      late: scanEvents.late,
    })
    .from(scanEvents)
    .leftJoin(products, eq(scanEvents.productId, products.id))
    .leftJoin(users, eq(scanEvents.userId, users.id))
    .where(eq(scanEvents.sessionId, sessionId))
    .orderBy(scanEvents.scannedAt)
    .all();
}

export async function toXlsx(
  db: AppDatabase,
  report: VarianceReport,
  sessionName: string,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Inventario J&R';
  workbook.created = new Date();

  const summary = workbook.addWorksheet('Diferencias');
  summary.columns = [
    { header: 'SKU', key: 'sku', width: 16 },
    { header: 'Código', key: 'barcode', width: 18 },
    { header: 'Producto', key: 'name', width: 36 },
    { header: 'Esperado', key: 'expectedQty', width: 11 },
    { header: 'Contado', key: 'countedQty', width: 11 },
    { header: 'Diferencia', key: 'variance', width: 11 },
    ...(report.costEnabled
      ? [
          { header: 'Costo unitario', key: 'unitCost', width: 14 },
          { header: 'Valor esperado', key: 'expectedValue', width: 15 },
          { header: 'Valor contado', key: 'value', width: 15 },
          { header: 'Diferencia en valor', key: 'valueVariance', width: 18 },
        ]
      : []),
  ];
  for (const row of report.rows) {
    summary.addRow({
      sku: safeCell(row.sku ?? ''),
      barcode: safeCell(row.barcode),
      name: safeCell(row.name ?? ''),
      expectedQty: row.expectedQty,
      countedQty: row.countedQty,
      variance: row.variance,
      unitCost: centsToAmount(row.unitCostCents),
      expectedValue: centsToAmount(row.expectedValueCents),
      value: centsToAmount(row.countedValueCents),
      valueVariance: centsToAmount(row.valueVarianceCents),
    });
  }
  const totalRow = summary.addRow({
    name: 'Totales',
    expectedQty: report.totals.expectedQty,
    countedQty: report.totals.countedQty,
    variance: report.totals.variance,
    expectedValue: centsToAmount(report.totals.expectedValueCents),
    value: centsToAmount(report.totals.countedValueCents),
    valueVariance: centsToAmount(report.totals.valueVarianceCents),
  });
  totalRow.font = { bold: true };

  const detail = workbook.addWorksheet('Detalle de escaneos');
  detail.columns = [
    { header: 'Fecha y hora', key: 'scannedAt', width: 22 },
    { header: 'Código', key: 'barcode', width: 18 },
    { header: 'SKU', key: 'sku', width: 16 },
    { header: 'Producto', key: 'name', width: 32 },
    { header: 'Cantidad', key: 'quantity', width: 10 },
    { header: 'Lote', key: 'lot', width: 14 },
    { header: 'Expiración', key: 'expiryDate', width: 12 },
    ...(report.costEnabled ? [{ header: 'Costo unitario', key: 'unitCost', width: 14 }] : []),
    { header: 'Persona', key: 'person', width: 18 },
    { header: 'Equipo', key: 'deviceLabel', width: 14 },
    { header: 'Estado', key: 'state', width: 22 },
  ];
  for (const scan of listScanDetail(db, report.sessionId)) {
    detail.addRow({
      scannedAt: localDateTime(scan.scannedAt),
      barcode: safeCell(scan.barcode),
      sku: safeCell(scan.sku ?? ''),
      name: safeCell(scan.name ?? ''),
      quantity: scan.quantity,
      lot: safeCell(scan.lot ?? ''),
      expiryDate: scan.expiryDate ?? '',
      unitCost: centsToAmount(scan.unitCostCents),
      person: safeCell(scan.person ?? ''),
      deviceLabel: safeCell(scan.deviceLabel ?? ''),
      state: scan.late ? 'Tardío (no contado)' : 'Contado',
    });
  }

  for (const sheet of [summary, detail]) {
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    // Barcodes and SKUs stay text so leading zeros survive.
    for (const key of ['barcode', 'sku']) sheet.getColumn(key).numFmt = '@';
  }
  if (report.costEnabled) {
    for (const key of ['unitCost', 'expectedValue', 'value', 'valueVariance']) {
      summary.getColumn(key).numFmt = '"$"#,##0.00';
    }
    detail.getColumn('unitCost').numFmt = '"$"#,##0.00';
  }
  summary.headerFooter.oddHeader = safeCell(sessionName);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
