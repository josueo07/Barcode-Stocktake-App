import { beforeEach, describe, expect, it } from 'vitest';
import {
  cacheSessions,
  countAllPendingScans,
  countPendingScans,
  enqueueScan,
  getCachedSession,
  getCachedSessions,
  getPendingScans,
  getRecentScans,
  markScanStatus,
  offlineDb,
} from '../../src/db/offlineQueue';

describe('offline scan queue', () => {
  beforeEach(async () => {
    await offlineDb.scans.clear();
  });

  it('enqueues a scan as pending', async () => {
    const id = await enqueueScan(1, {
      clientScanId: 'a',
      barcode: '111',
      scannedAt: new Date().toISOString(),
    });
    const pending = await getPendingScans(1);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ id, barcode: '111', status: 'pending' });
  });

  it('scopes pending scans to a session', async () => {
    await enqueueScan(1, {
      clientScanId: 'a',
      barcode: '111',
      scannedAt: new Date().toISOString(),
    });
    await enqueueScan(2, {
      clientScanId: 'b',
      barcode: '222',
      scannedAt: new Date().toISOString(),
    });

    expect(await getPendingScans(1)).toHaveLength(1);
    expect(await countPendingScans(2)).toBe(1);
  });

  it('marking a scan synced removes it from the pending set', async () => {
    const id = await enqueueScan(1, {
      clientScanId: 'a',
      barcode: '111',
      scannedAt: new Date().toISOString(),
    });
    await markScanStatus(id, 'synced');
    expect(await getPendingScans(1)).toHaveLength(0);
  });

  it('marking a scan failed records the error message', async () => {
    const id = await enqueueScan(1, {
      clientScanId: 'a',
      barcode: '111',
      scannedAt: new Date().toISOString(),
    });
    await markScanStatus(id, 'failed', 'network error');

    const recent = await getRecentScans(1);
    expect(recent[0]).toMatchObject({ status: 'failed', errorMessage: 'network error' });
  });
});

describe('offline queue per person and session cache', () => {
  beforeEach(async () => {
    await offlineDb.scans.clear();
    await offlineDb.sessions.clear();
  });

  it('only returns the signed-in person’s pending scans, oldest first', async () => {
    const now = new Date().toISOString();
    await enqueueScan(1, { clientScanId: 'a', barcode: '111', scannedAt: now }, 7);
    await enqueueScan(1, { clientScanId: 'b', barcode: '222', scannedAt: now }, 8);
    await enqueueScan(1, { clientScanId: 'c', barcode: '333', scannedAt: now }, 7);

    const mine = await getPendingScans(1, 7);
    expect(mine.map((s) => s.clientScanId)).toEqual(['a', 'c']);
    expect(await countAllPendingScans(8)).toBe(1);
  });

  it('keeps the last seen copy of sessions for offline reopen', async () => {
    const session = {
      id: 5,
      name: 'Anual',
      status: 'active' as const,
      notes: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date().toISOString(),
    };
    await cacheSessions([session]);
    expect(await getCachedSession(5)).toEqual(session);
    expect(await getCachedSessions()).toHaveLength(1);
  });
});
