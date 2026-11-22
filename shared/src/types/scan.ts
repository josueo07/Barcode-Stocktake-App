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
  countedQty: number;
}
