import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { CountUpdatePayload } from '@barcode-stocktake/shared';
import { SOCKET_EVENTS } from '@barcode-stocktake/shared';
import { BarcodeScanner } from '../components/scanner/BarcodeScanner';
import { CameraDeviceSelect } from '../components/scanner/CameraDeviceSelect';
import { RecentScansList } from '../components/scanner/RecentScansList';
import { SyncStatusBanner } from '../components/scanner/SyncStatusBanner';
import { useSessionContext } from '../context/useSessionContext';
import { enqueueScan, getRecentScans, type QueuedScan } from '../db/offlineQueue';
import { useOfflineSync } from '../hooks/useOfflineSync';

function isLikelyMobile(): boolean {
  return /Mobi|Android|iPhone/i.test(navigator.userAgent);
}

export function ScanPage() {
  const { session, socket } = useSessionContext();
  const syncState = useOfflineSync(session.id);
  const [recentScans, setRecentScans] = useState<QueuedScan[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>();
  const [lastConfirmed, setLastConfirmed] = useState<{ barcode: string; count: number } | null>(null);

  const refreshRecent = useCallback(async () => {
    setRecentScans(await getRecentScans(session.id));
  }, [session.id]);

  useEffect(() => {
    refreshRecent();
  }, [refreshRecent]);

  useEffect(() => {
    if (!socket) return undefined;
    const handleCountUpdate = (payload: CountUpdatePayload) => {
      setLastConfirmed({ barcode: payload.barcode, count: payload.newCount });
      refreshRecent();
    };
    socket.on(SOCKET_EVENTS.COUNT_UPDATE, handleCountUpdate);
    return () => {
      socket.off(SOCKET_EVENTS.COUNT_UPDATE, handleCountUpdate);
    };
  }, [socket, refreshRecent]);

  const handleDecode = useCallback(
    async (barcode: string) => {
      await enqueueScan(session.id, {
        clientScanId: uuidv4(),
        barcode,
        scannedAt: new Date().toISOString(),
        deviceLabel: isLikelyMobile() ? 'Phone' : 'PC',
      });
      await refreshRecent();
      syncState.flushNow();
    },
    [session.id, refreshRecent, syncState],
  );

  if (session.status !== 'active') {
    return (
      <p className="scan-page-inactive">
        This session is <strong>{session.status}</strong>. Start it from the Dashboard tab before
        scanning.
      </p>
    );
  }

  return (
    <div className="scan-page">
      <SyncStatusBanner {...syncState} />
      <CameraDeviceSelect value={deviceId} onChange={setDeviceId} />
      <BarcodeScanner active onDecode={handleDecode} deviceId={deviceId} />
      {lastConfirmed && (
        <p className="last-scan-feedback">
          Last confirmed: <strong>{lastConfirmed.barcode}</strong> — running total{' '}
          {lastConfirmed.count}
        </p>
      )}
      <h2>Recent scans (this device)</h2>
      <RecentScansList scans={recentScans} />
    </div>
  );
}
