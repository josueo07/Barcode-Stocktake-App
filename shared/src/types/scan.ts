export interface ScanEvent {
  id: number;
  sessionId: number;
  productId: number | null;
  barcode: string;
  clientScanId: string;
  deviceLabel: string | null;
  quantity: number;
  /** Received after the session closed; excluded from counts until a supervisor accepts it. */
  late: boolean;
  userId: number | null;
  lot: string | null;
  expiryDate: string | null;
  unitCostCents: number | null;
  scannedAt: string;
  syncedAt: string;
  createdAt: string;
}

/** Payload the client sends for a single scan, online or queued offline. */
export interface ScanSubmission {
  clientScanId: string;
  barcode: string;
  quantity?: number;
  scannedAt: string;
  deviceLabel?: string;
  /** Optional pharmacy details, typed by the counter after the scan. */
  lot?: string;
  expiryDate?: string;
  unitCostCents?: number;
  /**
   * Name typed by the counter for a product that isn't in the pharmacy's file. The server
   * creates the product with it; ignored when the barcode is already known.
   */
  newProductName?: string;
}

export interface BatchScanRequest {
  scans: ScanSubmission[];
}

/**
 * accepted/duplicate: counted. late: stored on the server but held for supervisor review because
 * the session had already closed. error: rejected (the client keeps it as failed).
 */
export type BatchScanItemStatus = 'accepted' | 'duplicate' | 'late' | 'error';

export interface BatchScanItemResult {
  clientScanId: string;
  status: BatchScanItemStatus;
  error?: string;
}

export interface BatchScanResponse {
  results: BatchScanItemResult[];
}

export interface LiveCount {
  productId: number | null;
  barcode: string;
  sku: string | null;
  name: string | null;
  expectedQty: number | null;
  /** Unit cost from the imported file (cents), when it had one. */
  expectedUnitCostCents: number | null;
  countedQty: number;
}
