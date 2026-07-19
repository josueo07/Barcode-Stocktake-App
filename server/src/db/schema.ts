import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const products = sqliteTable(
  'products',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sku: text('sku').notNull(),
    barcode: text('barcode').notNull(),
    name: text('name').notNull(),
    category: text('category'),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    skuIdx: uniqueIndex('products_sku_idx').on(table.sku),
    barcodeIdx: uniqueIndex('products_barcode_idx').on(table.barcode),
  }),
);

export const stocktakeSessions = sqliteTable('stocktake_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  status: text('status', { enum: ['draft', 'active', 'completed'] })
    .notNull()
    .default('draft'),
  notes: text('notes'),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const sessionExpectedQuantities = sqliteTable(
  'session_expected_quantities',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionId: integer('session_id')
      .notNull()
      .references(() => stocktakeSessions.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    expectedQty: integer('expected_qty').notNull(),
    source: text('source', { enum: ['csv_import', 'manual'] }).notNull(),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    sessionProductIdx: uniqueIndex('seq_session_product_idx').on(table.sessionId, table.productId),
  }),
);

export const scanEvents = sqliteTable(
  'scan_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionId: integer('session_id')
      .notNull()
      .references(() => stocktakeSessions.id, { onDelete: 'cascade' }),
    productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
    barcode: text('barcode').notNull(),
    clientScanId: text('client_scan_id').notNull(),
    deviceLabel: text('device_label'),
    quantity: integer('quantity').notNull().default(1),
    scannedAt: text('scanned_at').notNull(),
    syncedAt: text('synced_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    sessionClientScanIdx: uniqueIndex('scan_session_client_scan_idx').on(
      table.sessionId,
      table.clientScanId,
    ),
    sessionBarcodeIdx: index('scan_session_barcode_idx').on(table.sessionId, table.barcode),
  }),
);

export const varianceReportSnapshots = sqliteTable('variance_report_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id')
    .notNull()
    .references(() => stocktakeSessions.id, { onDelete: 'cascade' }),
  generatedAt: text('generated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  data: text('data', { mode: 'json' }).notNull(),
});
