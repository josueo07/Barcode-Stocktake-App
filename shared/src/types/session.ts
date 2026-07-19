export type SessionStatus = 'draft' | 'active' | 'completed';

export interface StocktakeSession {
  id: number;
  name: string;
  status: SessionStatus;
  notes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface CreateSessionInput {
  name: string;
  notes?: string | null;
}

export interface UpdateSessionInput {
  name?: string;
  notes?: string | null;
  status?: SessionStatus;
}

export type ExpectedQuantitySource = 'csv_import' | 'manual';

export interface SessionExpectedQuantity {
  id: number;
  sessionId: number;
  productId: number;
  expectedQty: number;
  source: ExpectedQuantitySource;
  createdAt: string;
  updatedAt: string;
  // Denormalized product fields, populated on read for convenience.
  sku: string;
  barcode: string;
  name: string;
}

export interface ManualExpectedQuantityInput {
  barcode: string;
  expectedQty: number;
  /** Used only if the barcode doesn't match an existing product. */
  name?: string;
  sku?: string;
}

export interface CsvImportSummary {
  productsCreated: number;
  productsUpdated: number;
  expectedQuantitiesWritten: number;
  rowsSkipped: number;
  errors: CsvImportRowError[];
}

export interface CsvImportRowError {
  row: number;
  message: string;
}
