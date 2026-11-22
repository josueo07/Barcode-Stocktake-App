export type { Product, CreateProductInput, UpdateProductInput } from './types/product.js';

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
} from './types/session.js';

export type {
  ScanEvent,
  ScanSubmission,
  BatchScanRequest,
  BatchScanItemStatus,
  BatchScanItemResult,
  BatchScanResponse,
  LiveCount,
} from './types/scan.js';

export type {
  VarianceReportRow,
  VarianceReportTotals,
  VarianceReport,
} from './types/varianceReport.js';

export type {
  CountUpdatePayload,
  StatusChangedPayload,
  ExpectedQtyUpdatedPayload,
} from './constants.js';
export { SOCKET_EVENTS, MAX_BATCH_SCAN_SIZE, SCAN_DEBOUNCE_MS } from './constants.js';

export type {
  UserRole,
  AuthUser,
  LoginRequest,
  LoginResponse,
  UserSummary,
  ProfileStats,
} from './types/auth.js';
