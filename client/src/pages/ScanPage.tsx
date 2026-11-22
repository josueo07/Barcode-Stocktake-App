import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { CountUpdatePayload } from '@barcode-stocktake/shared';
import { SOCKET_EVENTS } from '@barcode-stocktake/shared';
import { BarcodeScanner } from '../components/scanner/BarcodeScanner';
import { CameraDeviceSelect } from '../components/scanner/CameraDeviceSelect';
import { RecentScansList } from '../components/scanner/RecentScansList';
import { SyncStatusBanner } from '../components/scanner/SyncStatusBanner';
import { useSessionContext } from '../context/useSessionContext';
import { useAuth } from '../auth/AuthContext';
import { enqueueScan, getRecentScans, type QueuedScan } from '../db/offlineQueue';
import { getDeviceLabel } from '../lib/device';
import { useOfflineSync } from '../hooks/useOfflineSync';

export function ScanPage() {
  const { session, socket } = useSessionContext();
  const { user } = useAuth();
  const syncState = useOfflineSync(session.id);
  const [recentScans, setRecentScans] = useState<QueuedScan[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>();
  const [lastConfirmed, setLastConfirmed] = useState<{ barcode: string; count: number } | null>(
    null,
  );

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
      await enqueueScan(
        session.id,
        {
          clientScanId: uuidv4(),
          barcode,
          scannedAt: new Date().toISOString(),
          deviceLabel: getDeviceLabel(),
        },
        user?.id,
      );
      await refreshRecent();
      syncState.flushNow();
    },
    [session.id, user?.id, refreshRecent, syncState],
  );

  if (session.status !== 'active') {
    return (
      <p className="scan-page-inactive">
        Este conteo no está en curso. Un supervisor tiene que iniciarlo antes de escanear.
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
          Último confirmado: <strong>{lastConfirmed.barcode}</strong>, total {lastConfirmed.count}
        </p>
      )}
      <h2>Últimos escaneos (este teléfono)</h2>
      <RecentScansList scans={recentScans} />
    </div>
  );
}
