import { createDatabase, type DatabaseHandle } from '../src/db/client';

/**
 * Mirrors server/src/db/schema.ts as raw DDL so tests can bootstrap an in-memory database
 * without depending on `drizzle-kit generate` having been run first. Keep in sync with
 * schema.ts if columns/constraints change.
 */
const SCHEMA_SQL = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX users_username_idx ON users (username);

CREATE TABLE auth_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX auth_tokens_token_hash_idx ON auth_tokens (token_hash);

CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL,
  barcode TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX products_sku_idx ON products (sku);
CREATE UNIQUE INDEX products_barcode_idx ON products (barcode);

CREATE TABLE stocktake_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE session_expected_quantities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES stocktake_sessions(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  expected_qty INTEGER NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX seq_session_product_idx ON session_expected_quantities (session_id, product_id);

CREATE TABLE scan_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES stocktake_sessions(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  barcode TEXT NOT NULL,
  client_scan_id TEXT NOT NULL,
  device_label TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  late INTEGER NOT NULL DEFAULT 0,
  scanned_at TEXT NOT NULL,
  synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX scan_session_client_scan_idx ON scan_events (session_id, client_scan_id);
CREATE INDEX scan_session_barcode_idx ON scan_events (session_id, barcode);

CREATE TABLE variance_report_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES stocktake_sessions(id) ON DELETE CASCADE,
  generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data TEXT NOT NULL
);
`;

export function createTestDatabase(): DatabaseHandle {
  const handle = createDatabase(':memory:');
  handle.sqlite.exec(SCHEMA_SQL);
  return handle;
}
