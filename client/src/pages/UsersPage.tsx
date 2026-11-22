import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { UserSummary } from '@barcode-stocktake/shared';
import { createUser, listUsers, updateUser } from '../api/users';
import { useAuth } from '../auth/AuthContext';
import { Avatar } from '../components/common/Avatar';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { LoadingIndicator } from '../components/common/LoadingIndicator';

/** One supervisor runs the count; everyone else is a counter. */
export function UsersPage() {
  const { user: me, isSupervisor } = useAuth();
  const [users, setUsers] = useState<UserSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ username: '', displayName: '', pin: '' });
  const [isSaving, setIsSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setUsers(await listUsers());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la lista');
    }
  }, []);

  useEffect(() => {
    if (isSupervisor) refresh();
  }, [refresh, isSupervisor]);

  if (!isSupervisor) {
    return (
      <div className="page">
        <p className="empty-state">Solo el supervisor puede administrar personas.</p>
      </div>
    );
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await createUser({ ...form, role: 'counter' });
      setForm({ username: '', displayName: '', pin: '' });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo añadir');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (u: UserSummary) => {
    try {
      await updateUser(u.id, { active: !u.active });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar');
    }
  };

  const resetPin = async (u: UserSummary) => {
    const pin = window.prompt(`Nuevo PIN para ${u.displayName} (mínimo 6 caracteres)`);
    if (!pin) return;
    try {
      await updateUser(u.id, { pin });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el PIN');
    }
  };

  const supervisors = users?.filter((u) => u.role === 'supervisor' && u.active) ?? [];
  const counters = users?.filter((u) => u.role === 'counter') ?? [];

  const row = (u: UserSummary) => (
    <li key={u.id} className={`list-row person-row${u.active ? '' : ' person-row--inactive'}`}>
      <Avatar name={u.displayName} />
      <div className="person-text">
        <span className="person-name">
          {u.displayName}
          {u.id === me?.id && <span className="list-row-detail"> (tú)</span>}
        </span>
        <span className="list-row-detail">
          @{u.username}
          {!u.active && ' · desactivado'}
        </span>
      </div>
      <div className="person-actions">
        <button type="button" className="button-plain" onClick={() => resetPin(u)}>
          PIN
        </button>
        {u.id !== me?.id && (
          <button
            type="button"
            className={u.active ? 'button-plain button-plain--danger' : 'button-plain'}
            onClick={() => toggleActive(u)}
          >
            {u.active ? 'Desactivar' : 'Activar'}
          </button>
        )}
      </div>
    </li>
  );

  return (
    <div className="page users-page">
      <Link to="/perfil" className="back-link">
        ‹ Perfil
      </Link>
      <h1 className="large-title">Personas</h1>

      {error && <ErrorBanner message={error} />}
      {!users && !error && <LoadingIndicator />}

      {users && (
        <>
          <h2 className="group-title">Supervisor</h2>
          <ul className="list-group">{supervisors.map(row)}</ul>

          <h2 className="group-title">Contadores ({counters.filter((u) => u.active).length})</h2>
          {counters.length === 0 ? (
            <p className="group-footer">Todavía no hay contadores. Añádelos abajo.</p>
          ) : (
            <ul className="list-group">{counters.map(row)}</ul>
          )}
        </>
      )}

      <h2 className="group-title">Añadir contador</h2>
      <form className="card form-card" onSubmit={handleCreate}>
        <label className="field">
          <span>Nombre</span>
          <input
            placeholder="Ana Rivera"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            required
          />
        </label>
        <label className="field">
          <span>Usuario para entrar</span>
          <input
            placeholder="ana"
            autoCapitalize="none"
            autoCorrect="off"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
        </label>
        <label className="field">
          <span>PIN (mínimo 6)</span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={6}
            value={form.pin}
            onChange={(e) => setForm({ ...form, pin: e.target.value })}
            required
          />
        </label>
        <button type="submit" disabled={isSaving}>
          {isSaving ? 'Guardando…' : 'Añadir contador'}
        </button>
      </form>
      <p className="group-footer">
        Solo hay un supervisor. Todas las personas que añadas aquí son contadores.
      </p>
    </div>
  );
}
