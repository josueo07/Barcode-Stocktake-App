import { useCallback, useEffect, useState } from 'react';
import type { LiveCount, SessionStatus } from '@barcode-stocktake/shared';
import { SOCKET_EVENTS } from '@barcode-stocktake/shared';
import { getCounts } from '../api/scans';
import { deleteExpectedQuantity, updateSession } from '../api/sessions';
import { useAuth } from '../auth/AuthContext';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { LiveCountTable } from '../components/dashboard/LiveCountTable';
import { CsvUploadForm } from '../components/import/CsvUploadForm';
import { ManualEntryForm } from '../components/import/ManualEntryForm';
import { useSessionContext } from '../context/useSessionContext';

const NEXT_STATUS: Partial<Record<SessionStatus, SessionStatus>> = {
  draft: 'active',
  active: 'completed',
};

const NEXT_STATUS_LABEL: Partial<Record<SessionStatus, string>> = {
  draft: 'Start session',
  active: 'Complete session',
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
      setError(err instanceof Error ? err.message : 'Failed to load counts');
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
      setError(err instanceof Error ? err.message : 'Failed to remove expected quantity');
    }
  };

  const handleAdvanceStatus = async () => {
    if (!nextStatus) return;
    setIsChangingStatus(true);
    try {
      await updateSession(session.id, { status: nextStatus });
      await refreshSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update session status');
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
            {isChangingStatus ? 'Updating…' : NEXT_STATUS_LABEL[session.status]}
          </button>
        )}
        {session.status === 'completed' && (
          <p>This session is complete. View the variance report.</p>
        )}
      </section>

      {isSupervisor && session.status !== 'completed' && (
        <section className="dashboard-import">
          <h2>Expected quantities</h2>
          <CsvUploadForm sessionId={session.id} onImported={refreshCounts} />
          <ManualEntryForm sessionId={session.id} onAdded={refreshCounts} />
        </section>
      )}

      <section className="dashboard-counts">
        <h2>Live counts</h2>
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
