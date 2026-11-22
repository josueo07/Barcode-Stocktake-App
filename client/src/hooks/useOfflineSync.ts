import { useCallback, useEffect, useState } from 'react';
import { MAX_BATCH_SCAN_SIZE } from '@barcode-stocktake/shared';
import { submitScanBatch } from '../api/scans';
import { loadAuth } from '../auth/authStore';
import { countPendingScans, getPendingScans, markScanStatus } from '../db/offlineQueue';
import { useOnlineStatus } from './useOnlineStatus';

const SYNC_INTERVAL_MS = 8000;

export interface OfflineSyncState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastError: string | null;
  flushNow: () => Promise<void>;
}

/** Periodically flushes the Dexie offline queue to the server; safe to call flushNow() anytime. */
export function useOfflineSync(sessionId: number | null): OfflineSyncState {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const refreshPendingCount = useCallback(async () => {
    if (sessionId === null) return;
    setPendingCount(await countPendingScans(sessionId, loadAuth()?.user.id));
  }, [sessionId]);

  const flush = useCallback(async () => {
    if (sessionId === null || !isOnline) return;
    const userId = loadAuth()?.user.id;
    if (userId === undefined) return;

    // Only this person's scans: each scan must be sent with the login of whoever made it.
    const pending = await getPendingScans(sessionId, userId);
    if (pending.length === 0) return;

    setIsSyncing(true);
    setLastError(null);

    try {
      const batch = pending.slice(0, MAX_BATCH_SCAN_SIZE);
      const response = await submitScanBatch(
        sessionId,
        batch.map(
          ({
            id: _id,
            sessionId: _sessionId,
            status: _status,
            errorMessage: _err,
            queuedAt: _q,
            ...submission
          }) => submission,
        ),
      );

      await Promise.all(
        response.results.map(async (result, index) => {
          const queuedScan = batch[index];
          if (queuedScan?.id === undefined) return;
          // 'late' scans were stored on the server for supervisor review, so they are done here.
          if (result.status === 'error') {
            await markScanStatus(queuedScan.id, 'failed', result.error);
          } else {
            await markScanStatus(queuedScan.id, 'synced');
          }
        }),
      );
    } catch (err) {
      setLastError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
      await refreshPendingCount();
    }
  }, [sessionId, isOnline, refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  useEffect(() => {
    if (isOnline) {
      flush();
    }
    // Only re-run when connectivity flips, not on every `flush` identity change (avoids a sync storm).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  // iOS pauses timers in the background; sync as soon as the app is back in front.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') flush();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [flush]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isOnline) flush();
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isOnline, flush]);

  return { isOnline, pendingCount, isSyncing, lastError, flushNow: flush };
}
