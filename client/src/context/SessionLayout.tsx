import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import type { StocktakeSession } from '@barcode-stocktake/shared';
import { SOCKET_EVENTS } from '@barcode-stocktake/shared';
import { getSession } from '../api/sessions';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { LoadingIndicator } from '../components/common/LoadingIndicator';
import { SessionStatusBadge } from '../components/dashboard/SessionStatusBadge';
import { useSocket } from '../hooks/useSocket';
import { SessionContext } from './useSessionContext';

export function SessionLayout() {
  const { id } = useParams<{ id: string }>();
  const sessionId = Number(id);
  const [session, setSession] = useState<StocktakeSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socket = useSocket(Number.isNaN(sessionId) ? null : sessionId);

  const refreshSession = useCallback(async () => {
    try {
      const result = await getSession(sessionId);
      setSession(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    }
  }, [sessionId]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (!socket) return undefined;
    socket.on(SOCKET_EVENTS.STATUS_CHANGED, refreshSession);
    return () => {
      socket.off(SOCKET_EVENTS.STATUS_CHANGED, refreshSession);
    };
  }, [socket, refreshSession]);

  if (error) return <ErrorBanner message={error} />;
  if (!session) return <LoadingIndicator label="Loading session…" />;

  return (
    <SessionContext.Provider value={{ session, refreshSession, socket }}>
      <div className="session-layout">
        <header className="session-header">
          <Link to="/" className="back-link">
            &larr; Sessions
          </Link>
          <h1>{session.name}</h1>
          <SessionStatusBadge status={session.status} />
          <nav className="session-nav">
            <NavLink to="" end>
              Dashboard
            </NavLink>
            <NavLink to="scan">Scan</NavLink>
            <NavLink to="report">Report</NavLink>
          </nav>
        </header>
        <main className="session-main">
          <Outlet />
        </main>
      </div>
    </SessionContext.Provider>
  );
}
