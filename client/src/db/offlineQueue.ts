import Dexie, { type Table } from 'dexie';
import type { ScanSubmission, StocktakeSession } from '@barcode-stocktake/shared';

export type QueuedScanStatus = 'pending' | 'synced' | 'failed';

export interface QueuedScan extends ScanSubmission {
  id?: number;
  sessionId: number;
  /** Who scanned it. Scans are only ever sent with that same person's login. */
  userId?: number;
  status: QueuedScanStatus;
  errorMessage?: string;
  queuedAt: string;
}

/** Last copy of a session the device saw, so the app can reopen in airplane mode. */
export interface CachedSession {
  id: number;
  session: StocktakeSession;
  cachedAt: string;
}

class OfflineQueueDatabase extends Dexie {
  scans!: Table<QueuedScan, number>;
  sessions!: Table<CachedSession, number>;

  constructor() {
    super('barcode-stocktake-offline-queue');
    this.version(1).stores({
      scans: '++id, sessionId, status, clientScanId, [sessionId+status]',
    });
    this.version(2).stores({
      scans: '++id, sessionId, status, clientScanId, [sessionId+status], userId',
      sessions: 'id',
    });
  }
}

export const offlineDb = new OfflineQueueDatabase();

/** Writes a scan to IndexedDB unconditionally (online or offline) before anything touches the network. */
export async function enqueueScan(
  sessionId: number,
  scan: ScanSubmission,
  userId?: number,
): Promise<number> {
  return offlineDb.scans.add({
    ...scan,
    sessionId,
    userId,
    status: 'pending',
    queuedAt: new Date().toISOString(),
  });
}

function belongsTo(userId: number | undefined) {
  return (scan: QueuedScan) =>
    userId === undefined || scan.userId === undefined || scan.userId === userId;
}

/** Pending scans for a session, oldest first. When userId is given, only that person's scans. */
export async function getPendingScans(sessionId: number, userId?: number): Promise<QueuedScan[]> {
  const scans = await offlineDb.scans.where({ sessionId, status: 'pending' }).toArray();
  return scans.filter(belongsTo(userId)).sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
}

export async function countPendingScans(sessionId: number, userId?: number): Promise<number> {
  return (await getPendingScans(sessionId, userId)).length;
}

/** Pending scans on this device across every session (used to warn before signing out). */
export async function countAllPendingScans(userId?: number): Promise<number> {
  const scans = await offlineDb.scans.where('status').equals('pending').toArray();
  return scans.filter(belongsTo(userId)).length;
}

export async function getRecentScans(sessionId: number, limit = 25): Promise<QueuedScan[]> {
  const scans = await offlineDb.scans.where('sessionId').equals(sessionId).toArray();
  return scans.sort((a, b) => ((a.id ?? 0) < (b.id ?? 0) ? 1 : -1)).slice(0, limit);
}

export async function markScanStatus(
  id: number,
  status: QueuedScanStatus,
  errorMessage?: string,
): Promise<void> {
  await offlineDb.scans.update(id, { status, errorMessage });
}

export async function cacheSessions(sessions: StocktakeSession[]): Promise<void> {
  const cachedAt = new Date().toISOString();
  await offlineDb.sessions.bulkPut(
    sessions.map((session) => ({ id: session.id, session, cachedAt })),
  );
}

export async function getCachedSession(id: number): Promise<StocktakeSession | undefined> {
  return (await offlineDb.sessions.get(id))?.session;
}

export async function getCachedSessions(): Promise<StocktakeSession[]> {
  return (await offlineDb.sessions.toArray()).map((c) => c.session);
}
