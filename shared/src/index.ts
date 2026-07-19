export type { Product, CreateProductInput } from './types/product';

export type {
  SessionStatus,
  StocktakeSession,
  CreateSessionInput,
  UpdateSessionInput,
  ExpectedQuantitySource,
  SessionExpectedQuantity,
  ManualExpectedQuantityInput,
  CsvImportSummary,
  CsvImportRowError,
} from './types/session';

export type {
  ScanEvent,
  ScanSubmission,
  BatchScanRequest,
  BatchScanItemStatus,
  BatchScanItemResult,
  BatchScanResponse,
  LiveCount,
} from './types/scan';

export type { VarianceReportRow, VarianceReportTotals, VarianceReport } from './types/varianceReport';

export type { CountUpdatePayload, StatusChangedPayload, ExpectedQtyUpdatedPayload } from './constants';
export { SOCKET_EVENTS, MAX_BATCH_SCAN_SIZE, SCAN_DEBOUNCE_MS } from './constants';
