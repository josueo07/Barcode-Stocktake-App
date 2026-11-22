import { useCallback, useEffect, useState } from 'react';
import type { VarianceReport } from '@barcode-stocktake/shared';
import { SOCKET_EVENTS } from '@barcode-stocktake/shared';
import { downloadVarianceReportCsv, getVarianceReport } from '../api/scans';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { LoadingIndicator } from '../components/common/LoadingIndicator';
import { VarianceReportTable } from '../components/report/VarianceReportTable';
import { useSessionContext } from '../context/useSessionContext';

export function VarianceReportPage() {
  const { session, socket } = useSessionContext();
  const [report, setReport] = useState<VarianceReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setReport(await getVarianceReport(session.id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load variance report');
    }
  }, [session.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!socket) return undefined;
    socket.on(SOCKET_EVENTS.COUNT_UPDATE, refresh);
    socket.on(SOCKET_EVENTS.EXPECTED_QTY_UPDATED, refresh);
    return () => {
      socket.off(SOCKET_EVENTS.COUNT_UPDATE, refresh);
      socket.off(SOCKET_EVENTS.EXPECTED_QTY_UPDATED, refresh);
    };
  }, [socket, refresh]);

  return (
    <div className="variance-report-page">
      <div className="variance-report-actions">
        <h2>Variance report</h2>
        <button
          type="button"
          onClick={() =>
            downloadVarianceReportCsv(session.id).catch((err: Error) => setError(err.message))
          }
        >
          Export CSV
        </button>
      </div>

      {error && <ErrorBanner message={error} />}
      {!report && !error && <LoadingIndicator />}
      {report && <VarianceReportTable report={report} />}
    </div>
  );
}
