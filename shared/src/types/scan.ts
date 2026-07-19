export interface ScanEvent {
  id: number;
  sessionId: number;
  productId: number | null;
  barcode: string;
  clientScanId: string;
  deviceLabel: string | null;
  quantity: number;
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

export type BatchScanItemStatus = 'accepted' | 'duplicate' | 'error';

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
