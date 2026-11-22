import type { QueuedScan } from '../../db/offlineQueue';

const STATUS_LABELS: Record<QueuedScan['status'], string> = {
  pending: 'En cola',
  synced: 'Enviado',
  failed: 'Error',
};

export function RecentScansList({ scans }: { scans: QueuedScan[] }) {
  if (scans.length === 0) {
    return (
      <p className="empty-state">Aún no hay escaneos. Apunta la cámara a un código de barras.</p>
    );
  }

  return (
    <ul className="recent-scans-list">
      {scans.map((scan) => (
        <li key={scan.id} className={`recent-scan recent-scan--${scan.status}`}>
          <span className="recent-scan-barcode">{scan.barcode}</span>
          <span className="recent-scan-qty">×{scan.quantity ?? 1}</span>
          {scan.lot && <span className="recent-scan-lot">Lote {scan.lot}</span>}
          {scan.expiryDate && <span className="recent-scan-lot">Exp. {scan.expiryDate}</span>}
          <span className="recent-scan-status">{STATUS_LABELS[scan.status]}</span>
          {scan.status === 'failed' && scan.errorMessage && (
            <span className="recent-scan-error">{scan.errorMessage}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
