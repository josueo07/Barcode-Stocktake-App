import type { OfflineSyncState } from '../../hooks/useOfflineSync';

export function SyncStatusBanner({ isOnline, pendingCount, isSyncing, lastError }: OfflineSyncState) {
  return (
    <div className={`sync-status-banner ${isOnline ? 'sync-status-banner--online' : 'sync-status-banner--offline'}`}>
      <span className="sync-status-dot" aria-hidden="true" />
      <span>
        {isOnline ? 'Online' : 'Offline — scans are queued on this device'}
        {pendingCount > 0 && ` · ${pendingCount} scan${pendingCount === 1 ? '' : 's'} pending sync`}
        {isSyncing && ' · syncing…'}
      </span>
      {lastError && (
        <span className="sync-status-error" role="alert">
          Sync error: {lastError}
        </span>
      )}
    </div>
  );
}
