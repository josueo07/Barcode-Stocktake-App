import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { CountUpdatePayload } from '@barcode-stocktake/shared';
import { SOCKET_EVENTS } from '@barcode-stocktake/shared';
import { BarcodeScanner } from '../components/scanner/BarcodeScanner';
import { CameraDeviceSelect } from '../components/scanner/CameraDeviceSelect';
import { RecentScansList } from '../components/scanner/RecentScansList';
import {
  ScanEntryPanel,
  type ProductLookup,
  type ScanEntryDetails,
} from '../components/scanner/ScanEntryPanel';
import { getProductByBarcode } from '../api/products';
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

  // The scan waits here until the counter confirms quantity (and optional details).
  const [pending, setPending] = useState<{ barcode: string; scannedAt: string } | null>(null);
  const [typedBarcode, setTypedBarcode] = useState('');
  const [lookup, setLookup] = useState<{ status: ProductLookup; name: string | null }>({
    status: 'loading',
    name: null,
  });

  useEffect(() => {
    if (!pending) return undefined;
    let cancelled = false;
    setLookup({ status: 'loading', name: null });
    const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 4000));
    Promise.race([getProductByBarcode(pending.barcode), timeout])
      .then((result) => {
        if (cancelled) return;
        if (result === 'timeout') setLookup({ status: 'unknown', name: null });
        else if (result) setLookup({ status: 'found', name: result.name });
        else setLookup({ status: 'new', name: null });
      })
      .catch(() => {
        if (!cancelled) setLookup({ status: 'unknown', name: null });
      });
    return () => {
      cancelled = true;
    };
  }, [pending]);

  const handleDecode = useCallback((barcode: string) => {
    // Ignore further decodes while a scan is waiting for confirmation.
    setPending((current) => current ?? { barcode, scannedAt: new Date().toISOString() });
  }, []);

  const handleSave = useCallback(
    async (details: ScanEntryDetails) => {
      if (!pending) return;
      await enqueueScan(
        session.id,
        {
          clientScanId: uuidv4(),
          barcode: pending.barcode,
          scannedAt: pending.scannedAt,
          deviceLabel: getDeviceLabel(),
          quantity: details.quantity,
          lot: details.lot,
          expiryDate: details.expiryDate,
          unitCostCents: details.unitCostCents,
          newProductName: details.newProductName,
        },
        user?.id,
      );
      setPending(null);
      await refreshRecent();
      syncState.flushNow();
    },
    [pending, session.id, user?.id, refreshRecent, syncState],
  );

  const handleTypedSubmit = (e: FormEvent) => {
    e.preventDefault();
    const code = typedBarcode.trim();
    if (!code) return;
    setTypedBarcode('');
    handleDecode(code);
  };

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
      {pending ? (
        <ScanEntryPanel
          key={pending.scannedAt}
          barcode={pending.barcode}
          productName={lookup.name}
          productLookup={lookup.status}
          costEnabled={session.costEnabled}
          onSave={handleSave}
          onCancel={() => setPending(null)}
        />
      ) : (
        <form className="typed-barcode-form" onSubmit={handleTypedSubmit}>
          <input
            inputMode="numeric"
            placeholder="Escribe el código"
            aria-label="Escribir el código a mano"
            value={typedBarcode}
            onChange={(e) => setTypedBarcode(e.target.value)}
          />
          <button type="submit" disabled={!typedBarcode.trim()}>
            Usar
          </button>
        </form>
      )}
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
