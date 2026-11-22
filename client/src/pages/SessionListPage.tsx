import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { StocktakeSession } from '@barcode-stocktake/shared';
import { createSession, deleteSession, listSessions } from '../api/sessions';
import { useAuth } from '../auth/AuthContext';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { LoadingIndicator } from '../components/common/LoadingIndicator';
import { SessionStatusBadge } from '../components/dashboard/SessionStatusBadge';

export function SessionListPage() {
  const [sessions, setSessions] = useState<StocktakeSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newSessionName, setNewSessionName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const navigate = useNavigate();
  const { isSupervisor } = useAuth();

  const refresh = useCallback(async () => {
    try {
      setSessions(await listSessions());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los conteos');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async (session: StocktakeSession) => {
    if (deletingId !== null) return;
    const message = `¿Borrar «${session.name}»? Se eliminarán permanentemente los escaneos, las cantidades esperadas y el reporte de este conteo.`;
    if (!window.confirm(message)) return;
    setDeletingId(session.id);
    try {
      await deleteSession(session.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar el conteo');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;

    setIsCreating(true);
    try {
      const session = await createSession({ name: newSessionName.trim() });
      setNewSessionName('');
      navigate(`/sessions/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el conteo');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="page session-list-page">
      <h1 className="large-title">Conteos</h1>

      {isSupervisor && (
        <form className="card new-session-form" onSubmit={handleCreate}>
          <input
            placeholder="ej. Inventario anual 2026"
            aria-label="Nombre del conteo nuevo"
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
          />
          <button type="submit" disabled={isCreating || !newSessionName.trim()}>
            {isCreating ? 'Creando…' : 'Nuevo conteo'}
          </button>
        </form>
      )}

      {error && <ErrorBanner message={error} />}
      {!sessions && !error && <LoadingIndicator />}

      {sessions && sessions.length === 0 && <p className="empty-state">Todavía no hay conteos.</p>}

      {sessions && sessions.length > 0 && (
        <ul className="list-group session-list">
          {sessions.map((session) => (
            <li key={session.id}>
              <Link to={`/sessions/${session.id}`}>
                <span className="session-list-name">{session.name}</span>
                <SessionStatusBadge status={session.status} />
              </Link>
              {isSupervisor && (
                <button
                  type="button"
                  className="link-button session-delete-button"
                  title="Borrar este conteo"
                  disabled={deletingId !== null}
                  aria-label={`Borrar conteo ${session.name}`}
                  onClick={() => handleDelete(session)}
                >
                  {deletingId === session.id ? 'Borrando…' : 'Borrar'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
