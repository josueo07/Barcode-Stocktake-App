import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import type { StocktakeSession } from '@barcode-stocktake/shared';
import { SOCKET_EVENTS } from '@barcode-stocktake/shared';
import { getSession } from '../api/sessions';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { LoadingIndicator } from '../components/common/LoadingIndicator';
import { SessionStatusBadge } from '../components/dashboard/SessionStatusBadge';
import { useAuth } from '../auth/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { SessionContext } from './useSessionContext';

export function SessionLayout() {
  const { id } = useParams<{ id: string }>();
  const sessionId = Number(id);
  const [session, setSession] = useState<StocktakeSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { isSupervisor } = useAuth();
  const socket = useSocket(Number.isNaN(sessionId) ? null : sessionId);

  const refreshSession = useCallback(async () => {
    try {
      const result = await getSession(sessionId);
      setSession(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el conteo');
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
  if (!session) return <LoadingIndicator label="Cargando conteo…" />;

  return (
    <SessionContext.Provider value={{ session, refreshSession, socket }}>
      <div className="page session-layout">
        <header className="session-header">
          <Link to="/" className="back-link">
            ‹ Conteos
          </Link>
          <div className="session-title-row">
            <h1 className="large-title">{session.name}</h1>
            <SessionStatusBadge status={session.status} />
          </div>
          <nav className="segmented" aria-label="Secciones del conteo">
            <NavLink to="" end>
              Resumen
            </NavLink>
            <NavLink to="scan">Escanear</NavLink>
            {isSupervisor && <NavLink to="report">Reporte</NavLink>}
          </nav>
        </header>
        <main className="session-main">
          <Outlet />
        </main>
      </div>
    </SessionContext.Provider>
  );
}
