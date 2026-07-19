import Dexie, { type Table } from 'dexie';
import type { ScanSubmission } from '@barcode-stocktake/shared';

export type QueuedScanStatus = 'pending' | 'synced' | 'failed';

export interface QueuedScan extends ScanSubmission {
  id?: number;
  sessionId: number;
  status: QueuedScanStatus;
  errorMessage?: string;
  queuedAt: string;
}

class OfflineQueueDatabase extends Dexie {
  scans!: Table<QueuedScan, number>;

  constructor() {
    super('barcode-stocktake-offline-queue');
    this.version(1).stores({
      scans: '++id, sessionId, status, clientScanId, [sessionId+status]',
    });
  }
}

export const offlineDb = new OfflineQueueDatabase();

/** Writes a scan to IndexedDB unconditionally (online or offline) before anything touches the network. */
export async function enqueueScan(sessionId: number, scan: ScanSubmission): Promise<number> {
  return offlineDb.scans.add({
    ...scan,
    sessionId,
    status: 'pending',
    queuedAt: new Date().toISOString(),
  });
}

export function getPendingScans(sessionId: number): Promise<QueuedScan[]> {
  return offlineDb.scans.where({ sessionId, status: 'pending' }).toArray();
}

export function countPendingScans(sessionId: number): Promise<number> {
  return offlineDb.scans.where({ sessionId, status: 'pending' }).count();
}

export async function getRecentScans(sessionId: number, limit = 25): Promise<QueuedScan[]> {
  const scans = await offlineDb.scans.where('sessionId').equals(sessionId).toArray();
  return scans.sort((a, b) => (a.id ?? 0) < (b.id ?? 0) ? 1 : -1).slice(0, limit);
}

export async function markScanStatus(
  id: number,
  status: QueuedScanStatus,
  errorMessage?: string,
): Promise<void> {
  await offlineDb.scans.update(id, { status, errorMessage });
}
