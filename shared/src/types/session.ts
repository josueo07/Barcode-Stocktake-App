export type SessionStatus = 'draft' | 'active' | 'completed';

export interface StocktakeSession {
  id: number;
  name: string;
  status: SessionStatus;
  notes: string | null;
  /** Counters may type a unit cost per scan; the report shows counted value. */
  costEnabled: boolean;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface CreateSessionInput {
  name: string;
  notes?: string | null;
  costEnabled?: boolean;
}

export interface UpdateSessionInput {
  name?: string;
  notes?: string | null;
  status?: SessionStatus;
  costEnabled?: boolean;
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
  quantityHeaders?: string[];
  errors: CsvImportRowError[];
}

export interface CsvImportRowError {
  row: number;
  message: string;
}
