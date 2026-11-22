import { useCallback, useEffect, useState } from 'react';
import type { LiveCount, SessionStatus } from '@barcode-stocktake/shared';
import { SOCKET_EVENTS } from '@barcode-stocktake/shared';
import { getCounts } from '../api/scans';
import { deleteExpectedQuantity, updateSession } from '../api/sessions';
import { useAuth } from '../auth/AuthContext';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { LateScansPanel } from '../components/dashboard/LateScansPanel';
import { LiveCountTable } from '../components/dashboard/LiveCountTable';
import { CsvUploadForm } from '../components/import/CsvUploadForm';
import { ManualEntryForm } from '../components/import/ManualEntryForm';
import { useSessionContext } from '../context/useSessionContext';

const NEXT_STATUS: Partial<Record<SessionStatus, SessionStatus>> = {
  draft: 'active',
  active: 'completed',
};

const NEXT_STATUS_LABEL: Partial<Record<SessionStatus, string>> = {
  draft: 'Iniciar conteo',
  active: 'Cerrar conteo',
};

export function SessionDashboardPage() {
  const { session, refreshSession, socket } = useSessionContext();
  const [counts, setCounts] = useState<LiveCount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  const refreshCounts = useCallback(async () => {
    try {
      setCounts(await getCounts(session.id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los conteos');
    }
  }, [session.id]);

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  useEffect(() => {
    if (!socket) return undefined;
    socket.on(SOCKET_EVENTS.COUNT_UPDATE, refreshCounts);
    socket.on(SOCKET_EVENTS.EXPECTED_QTY_UPDATED, refreshCounts);
    return () => {
      socket.off(SOCKET_EVENTS.COUNT_UPDATE, refreshCounts);
      socket.off(SOCKET_EVENTS.EXPECTED_QTY_UPDATED, refreshCounts);
    };
  }, [socket, refreshCounts]);

  const { isSupervisor } = useAuth();
  const nextStatus = isSupervisor ? NEXT_STATUS[session.status] : null;

  const handleRemoveExpected = async (productId: number) => {
    try {
      await deleteExpectedQuantity(session.id, productId);
      await refreshCounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar el esperado');
    }
  };

  const handleToggleCost = async (costEnabled: boolean) => {
    setIsChangingStatus(true);
    try {
      await updateSession(session.id, { costEnabled });
      await refreshSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el ajuste de costo');
    } finally {
      setIsChangingStatus(false);
    }
  };

  const handleAdvanceStatus = async () => {
    if (!nextStatus) return;
    if (
      nextStatus === 'completed' &&
      !window.confirm(
        '¿Cerrar el conteo? Después de cerrarlo no se pueden cambiar los esperados ni borrar escaneos, y lo que llegue tarde quedará aparte para revisión.',
      )
    ) {
      return;
    }
    setIsChangingStatus(true);
    try {
      await updateSession(session.id, { status: nextStatus });
      await refreshSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado');
    } finally {
      setIsChangingStatus(false);
    }
  };

  return (
    <div className="session-dashboard-page">
      {error && <ErrorBanner message={error} />}

      <section className="dashboard-actions">
        {nextStatus && (
          <button type="button" onClick={handleAdvanceStatus} disabled={isChangingStatus}>
            {isChangingStatus ? 'Actualizando…' : NEXT_STATUS_LABEL[session.status]}
          </button>
        )}
        {session.status === 'completed' && (
          <p>Este conteo está cerrado. Mira el reporte de diferencias.</p>
        )}
        {isSupervisor && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={session.costEnabled}
              disabled={session.status === 'completed' || isChangingStatus}
              onChange={(e) => handleToggleCost(e.target.checked)}
            />
            Anotar costo al escanear
          </label>
        )}
      </section>

      {isSupervisor && session.status !== 'completed' && (
        <section className="dashboard-import">
          <h2>Cantidades esperadas</h2>
          <CsvUploadForm sessionId={session.id} onImported={refreshCounts} />
          <ManualEntryForm sessionId={session.id} onAdded={refreshCounts} />
        </section>
      )}

      {isSupervisor && session.status === 'completed' && (
        <LateScansPanel sessionId={session.id} onAccepted={refreshCounts} />
      )}

      <section className="dashboard-counts">
        <h2>Conteo en vivo</h2>
        <LiveCountTable
          counts={counts}
          onRemoveExpected={
            isSupervisor && session.status !== 'completed' ? handleRemoveExpected : undefined
          }
        />
      </section>
    </div>
  );
}
