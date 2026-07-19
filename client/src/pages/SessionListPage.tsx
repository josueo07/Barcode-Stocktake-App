import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { StocktakeSession } from '@barcode-stocktake/shared';
import { createSession, listSessions } from '../api/sessions';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { LoadingIndicator } from '../components/common/LoadingIndicator';
import { SessionStatusBadge } from '../components/dashboard/SessionStatusBadge';

export function SessionListPage() {
  const [sessions, setSessions] = useState<StocktakeSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newSessionName, setNewSessionName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    try {
      setSessions(await listSessions());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;

    setIsCreating(true);
    try {
      const session = await createSession({ name: newSessionName.trim() });
      setNewSessionName('');
      navigate(`/sessions/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="session-list-page">
      <h1>Stocktake Sessions</h1>

      <form className="new-session-form" onSubmit={handleCreate}>
        <input
          placeholder="e.g. Warehouse A — July 2026"
          value={newSessionName}
          onChange={(e) => setNewSessionName(e.target.value)}
        />
        <button type="submit" disabled={isCreating || !newSessionName.trim()}>
          {isCreating ? 'Creating…' : 'New session'}
        </button>
      </form>

      {error && <ErrorBanner message={error} />}
      {!sessions && !error && <LoadingIndicator />}

      {sessions && sessions.length === 0 && (
        <p className="empty-state">No sessions yet — create one above to get started.</p>
      )}

      {sessions && sessions.length > 0 && (
        <ul className="session-list">
          {sessions.map((session) => (
            <li key={session.id}>
              <Link to={`/sessions/${session.id}`}>
                <span className="session-list-name">{session.name}</span>
                <SessionStatusBadge status={session.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
