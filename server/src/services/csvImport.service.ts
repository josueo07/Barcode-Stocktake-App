import { parse } from 'csv-parse/sync';
import { eq } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import type { CsvImportSummary } from '@barcode-stocktake/shared';
import type { AppDatabase } from '../db/client';
import { products, sessionExpectedQuantities } from '../db/schema';
import { findProductByBarcode } from './scan.service';

type Field = 'barcode' | 'name' | 'qty' | 'cost' | 'sku' | 'category';

/**
 * Header names accepted for each column, compared after lowercasing and removing accents,
 * spaces and punctuation ("Código de barras" → "codigodebarras"). Pharmacy files come from
 * different systems, so both Spanish and English names are accepted.
 */
const HEADER_ALIASES: Record<Field, string[]> = {
  barcode: [
    'barcode',
    'upc',
    'upccode',
    'ean',
    'codigo',
    'codigodebarra',
    'codigodebarras',
    'codigobarra',
    'codigobarras',
    'codbarra',
    'codbarras',
  ],
  name: ['name', 'nombre', 'descripcion', 'description', 'producto', 'product', 'item', 'articulo'],
  qty: [
    'expectedqty',
    'qty',
    'quantity',
    'cantidad',
    'cantidadsistema',
    'cantidadesperada',
    'cantidadenstock',
    'systemquantity',
    'expectedquantity',
    'cant',
    'existencia',
    'existencias',
    'inventario',
    'onhand',
    'stock',
  ],
  cost: [
    'cost',
    'costo',
    'unitcost',
    'costounitario',
    'costounidad',
    'costoporunidad',
    'costounitariousd',
  ],
  sku: ['sku', 'itemnumber', 'itemno', 'numerodearticulo', 'codigointerno'],
  category: ['category', 'categoria', 'departamento', 'department'],
};

const MAX_HEADER_SEARCH_ROWS = 10;

export function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function mapHeader(row: string[]): Partial<Record<Field, number>> {
  const columns: Partial<Record<Field, number>> = {};
  row.forEach((cell, index) => {
    const key = normalizeHeader(cell);
    for (const field of Object.keys(HEADER_ALIASES) as Field[]) {
      if (columns[field] === undefined && HEADER_ALIASES[field].includes(key)) {
        columns[field] = index;
      }
    }
  });
  return columns;
}

/** "1,200" → 1200, "12.0" → 12. Returns null when the text isn't a whole non-negative number. */
export function parseQuantity(raw: string): number | null {
  const cleaned = raw.replace(/[,\s]/g, '');
  if (cleaned === '' || !/^\d+(\.0+)?$/.test(cleaned)) return null;
  return Number.parseInt(cleaned, 10);
}

/** "$1,234.50" → 123450 cents. Returns null for blanks or text that isn't an amount. */
export function parseCostCents(raw: string): number | null | 'invalid' {
  const cleaned = raw.replace(/[$,\s]/g, '');
  if (cleaned === '') return null;
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return 'invalid';
  return Math.round(Number(cleaned) * 100);
}

function emptySummary(): CsvImportSummary {
  return {
    productsCreated: 0,
    productsUpdated: 0,
    expectedQuantitiesWritten: 0,
    rowsSkipped: 0,
    errors: [],
  };
}

function parseCsvRows(fileBuffer: Buffer): string[][] {
  const text = fileBuffer.toString('utf8').replace(/^\ufeff/, '');
  const options = { skip_empty_lines: true, trim: true, relax_column_count: true };
  const delimiter = [',', ';', '\t'].find((candidate) => {
    try {
      const preview = parse(text, {
        ...options,
        delimiter: candidate,
        to: MAX_HEADER_SEARCH_ROWS,
      }) as string[][];
      return preview.some((row) => {
        const header = mapHeader(row);
        return header.barcode !== undefined && header.name !== undefined;
      });
    } catch {
      return false;
    }
  });
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const fallback =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  return parse(text, { ...options, delimiter: delimiter ?? fallback }) as string[][];
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((part) => part.text).join('');
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue);
    if ('text' in value) return String(value.text);
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return '';
  }
  return String(value).trim();
}

async function parseXlsxRows(fileBuffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values: string[] = [];
    for (let col = 1; col <= row.cellCount; col += 1) {
      values.push(cellText(row.getCell(col).value));
    }
    rows.push(values);
  });
  return rows;
}

function isXlsx(fileBuffer: Buffer, filename?: string): boolean {
  if (filename && /\.xlsx$/i.test(filename)) return true;
  // .xlsx files are zip archives ("PK\x03\x04").
  return fileBuffer.length > 4 && fileBuffer.readUInt32LE(0) === 0x04034b50;
}

interface QuantityMapping {
  requireQuantity?: boolean;
  quantityColumn?: number;
}

/**
 * Imports the pharmacy's inventory file (CSV or Excel) into a session: every product with its
 * barcode (UPC), name, expected quantity and unit cost. Only the barcode and name are required;
 * without a quantity column the products are added to the catalog with no expected quantity.
 */
export async function importInventoryFile(
  db: AppDatabase,
  sessionId: number,
  fileBuffer: Buffer,
  filename?: string,
  mapping?: QuantityMapping,
): Promise<CsvImportSummary> {
  if (isXlsx(fileBuffer, filename)) {
    let rows: string[][];
    try {
      rows = await parseXlsxRows(fileBuffer);
    } catch (err) {
      const summary = emptySummary();
      summary.errors.push({
        row: 0,
        message: `No se pudo leer el Excel: ${(err as Error).message}`,
      });
      return summary;
    }
    return importRows(db, sessionId, rows, mapping);
  }
  return importCsv(db, sessionId, fileBuffer, mapping);
}

/** CSV-only entry point (also used by the demo seed). */
export function importCsv(
  db: AppDatabase,
  sessionId: number,
  fileBuffer: Buffer,
  mapping?: QuantityMapping,
): CsvImportSummary {
  let rows: string[][];
  try {
    rows = parseCsvRows(fileBuffer);
  } catch (err) {
    const summary = emptySummary();
    summary.errors.push({ row: 0, message: `No se pudo leer el CSV: ${(err as Error).message}` });
    return summary;
  }
  return importRows(db, sessionId, rows, mapping);
}

function uniqueSku(db: AppDatabase, wanted: string, barcode: string, productId?: number): string {
  for (const candidate of [wanted, barcode, `${wanted}-${barcode}`]) {
    const owner = db.select().from(products).where(eq(products.sku, candidate)).get();
    if (!owner || owner.id === productId) return candidate;
  }
  return `${barcode}-${Date.now()}`;
}

function importRows(
  db: AppDatabase,
  sessionId: number,
  rows: string[][],
  mapping: QuantityMapping = {},
): CsvImportSummary {
  const summary = emptySummary();

  const headerIndex = rows
    .slice(0, MAX_HEADER_SEARCH_ROWS)
    .findIndex((row) => mapHeader(row).barcode !== undefined);
  if (headerIndex === -1) {
    summary.errors.push({
      row: 1,
      message:
        'No encontré la columna del código. El archivo debe tener una columna "UPC" o "Código" y otra "Nombre".',
    });
    return summary;
  }
  const columns = mapHeader(rows[headerIndex] ?? []);
  if (columns.name === undefined) {
    summary.errors.push({
      row: headerIndex + 1,
      message: 'Falta la columna "Nombre" o "Descripción".',
    });
    return summary;
  }
  const header = rows[headerIndex] ?? [];
  const quantityCandidates = header.filter((cell) =>
    HEADER_ALIASES.qty.includes(normalizeHeader(cell)),
  );
  if (mapping.quantityColumn !== undefined) {
    const index = mapping.quantityColumn;
    if (!header[index]?.trim() || index === columns.barcode || index === columns.name) {
      summary.errors.push({
        row: headerIndex + 1,
        message: 'Selecciona una columna válida de cantidad esperada.',
      });
      return summary;
    }
    columns.qty = index;
  } else if (
    mapping.requireQuantity &&
    (columns.qty === undefined || quantityCandidates.length > 1)
  ) {
    summary.quantityHeaders = header;
    return summary;
  }
  const hasQty = columns.qty !== undefined;
  const get = (row: string[], field: Field) => {
    const index = columns[field];
    return index === undefined ? '' : (row[index] ?? '').trim();
  };

  // Totals per product for this file, so a UPC listed twice (e.g. two lots) adds up.
  const expected = new Map<number, { qty: number; unitCostCents: number | null }>();
  const touched = new Set<number>();

  return db.transaction(() => {
    rows.slice(headerIndex + 1).forEach((row, offset) => {
      const rowNumber = headerIndex + offset + 2; // 1-based, after the header row
      // "8 01108 11003 1" or "8-01108-11003-1" (as printed on the box) → "801108110031".
      const rawBarcode = get(row, 'barcode');
      const barcode = /^[\d\s-]+$/.test(rawBarcode) ? rawBarcode.replace(/[\s-]/g, '') : rawBarcode;
      const name = get(row, 'name');
      if (row.every((cell) => cell.trim() === '')) return;

      const skip = (message: string) => {
        summary.rowsSkipped += 1;
        summary.errors.push({ row: rowNumber, message });
      };

      if (/^\d+(\.\d+)?e\+\d+$/i.test(barcode)) {
        skip(
          `El código "${barcode}" quedó en notación científica (Excel lo convirtió). Guarda la columna de código como texto y vuelve a exportar.`,
        );
        return;
      }

      if (!barcode || !name) {
        skip('Falta el código o el nombre.');
        return;
      }

      let qty: number | null = null;
      if (hasQty) {
        const rawQty = get(row, 'qty');
        qty = rawQty === '' ? 0 : parseQuantity(rawQty);
        if (qty === null) {
          skip(`Cantidad no válida "${rawQty}" (debe ser un número entero, 0 o más).`);
          return;
        }
      }

      const cost = parseCostCents(get(row, 'cost'));
      if (cost === 'invalid') {
        skip(`Costo no válido "${get(row, 'cost')}".`);
        return;
      }

      const sku = get(row, 'sku');
      const category = get(row, 'category') || null;
      const now = new Date().toISOString();
      const existing = findProductByBarcode(db, barcode);

      let productId: number;
      if (existing) {
        db.update(products)
          .set({
            name,
            ...(category ? { category } : {}),
            ...(sku ? { sku: uniqueSku(db, sku, existing.barcode, existing.id) } : {}),
            updatedAt: now,
          })
          .where(eq(products.id, existing.id))
          .run();
        productId = existing.id;
        if (!touched.has(productId)) summary.productsUpdated += 1;
      } else {
        const inserted = db
          .insert(products)
          .values({ sku: uniqueSku(db, sku || barcode, barcode), barcode, name, category })
          .returning()
          .get();
        productId = inserted.id;
        summary.productsCreated += 1;
      }
      touched.add(productId);

      if (qty !== null) {
        const prev = expected.get(productId);
        expected.set(productId, {
          qty: (prev?.qty ?? 0) + qty,
          unitCostCents: cost ?? prev?.unitCostCents ?? null,
        });
      }
    });

    for (const [productId, { qty, unitCostCents }] of expected) {
      db.insert(sessionExpectedQuantities)
        .values({ sessionId, productId, expectedQty: qty, unitCostCents, source: 'csv_import' })
        .onConflictDoUpdate({
          target: [sessionExpectedQuantities.sessionId, sessionExpectedQuantities.productId],
          set: {
            expectedQty: qty,
            unitCostCents,
            source: 'csv_import',
            updatedAt: new Date().toISOString(),
          },
        })
        .run();
      summary.expectedQuantitiesWritten += 1;
    }

    return summary;
  });
}
