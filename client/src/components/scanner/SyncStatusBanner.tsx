import type { OfflineSyncState } from '../../hooks/useOfflineSync';

export function SyncStatusBanner({
  isOnline,
  pendingCount,
  isSyncing,
  lastError,
  flushNow,
}: OfflineSyncState) {
  return (
    <div
      className={`sync-status-banner ${isOnline ? 'sync-status-banner--online' : 'sync-status-banner--offline'}`}
    >
      <span className="sync-status-dot" aria-hidden="true" />
      <span>
        {isOnline ? 'En línea' : 'Sin conexión: los escaneos se guardan en este teléfono'}
        {pendingCount > 0 && ` · ${pendingCount} sin enviar`}
        {isSyncing && ' · enviando…'}
      </span>
      {isOnline && pendingCount > 0 && !isSyncing && (
        <button type="button" className="link-button" onClick={() => flushNow()}>
          Enviar ahora
        </button>
      )}
      {lastError && (
        <span className="sync-status-error" role="alert">
          Error al enviar: {lastError}
        </span>
      )}
    </div>
  );
}
