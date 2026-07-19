/** Socket.io event names shared between client and server, kept in one place to avoid typos. */
export const SOCKET_EVENTS = {
  JOIN_SESSION: 'join-session',
  LEAVE_SESSION: 'leave-session',
  COUNT_UPDATE: 'session:count-update',
  STATUS_CHANGED: 'session:status-changed',
  EXPECTED_QTY_UPDATED: 'session:expected-qty-updated',
} as const;

export interface CountUpdatePayload {
  sessionId: number;
  productId: number | null;
  barcode: string;
  newCount: number;
  lastScan: {
    clientScanId: string;
    scannedAt: string;
    deviceLabel: string | null;
  };
}

export interface StatusChangedPayload {
  sessionId: number;
  status: 'draft' | 'active' | 'completed';
}

/**
 * Fired after any change to a session's expected quantities (single manual edit or bulk CSV
 * import). Intentionally minimal — listeners refetch expected quantities / counts for the
 * session rather than trying to reconcile a per-row diff.
 */
export interface ExpectedQtyUpdatedPayload {
  sessionId: number;
}

/** Max scans accepted in a single offline-sync batch request. */
export const MAX_BATCH_SCAN_SIZE = 50;

/** Milliseconds within which a repeated decode of the same barcode is treated as one physical scan. */
export const SCAN_DEBOUNCE_MS = 1500;
