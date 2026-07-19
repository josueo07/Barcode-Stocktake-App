import type { QueuedScan } from '../../db/offlineQueue';

const STATUS_LABELS: Record<QueuedScan['status'], string> = {
  pending: 'Queued',
  synced: 'Synced',
  failed: 'Failed',
};

export function RecentScansList({ scans }: { scans: QueuedScan[] }) {
  if (scans.length === 0) {
    return <p className="empty-state">No scans yet — point the camera at a barcode.</p>;
  }

  return (
    <ul className="recent-scans-list">
      {scans.map((scan) => (
        <li key={scan.id} className={`recent-scan recent-scan--${scan.status}`}>
          <span className="recent-scan-barcode">{scan.barcode}</span>
          <span className="recent-scan-status">{STATUS_LABELS[scan.status]}</span>
          {scan.status === 'failed' && scan.errorMessage && (
            <span className="recent-scan-error">{scan.errorMessage}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
