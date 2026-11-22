import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { UserRole, UserSummary } from '@barcode-stocktake/shared';
import { createUser, listUsers, updateUser } from '../api/users';
import { useAuth } from '../auth/AuthContext';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { LoadingIndicator } from '../components/common/LoadingIndicator';

const ROLE_LABEL: Record<UserRole, string> = { supervisor: 'Supervisor', counter: 'Contador' };

export function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    username: '',
    displayName: '',
    role: 'counter' as UserRole,
    pin: '',
  });
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
    refresh();
  }, [refresh]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await createUser(form);
      setForm({ username: '', displayName: '', role: 'counter', pin: '' });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la persona');
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

  return (
    <div className="users-page">
      <Link to="/" className="back-link">
        &larr; Sesiones
      </Link>
      <h1>Personas</h1>

      <form className="user-form" onSubmit={handleCreate}>
        <input
          placeholder="Usuario (ej. maria)"
          autoCapitalize="none"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          required
        />
        <input
          placeholder="Nombre"
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          required
        />
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
        >
          <option value="counter">Contador</option>
          <option value="supervisor">Supervisor</option>
        </select>
        <input
          type="password"
          placeholder="PIN (mín. 6)"
          minLength={6}
          value={form.pin}
          onChange={(e) => setForm({ ...form, pin: e.target.value })}
          required
        />
        <button type="submit" disabled={isSaving}>
          {isSaving ? 'Guardando…' : 'Añadir'}
        </button>
      </form>

      {error && <ErrorBanner message={error} />}
      {!users && !error && <LoadingIndicator />}

      {users && (
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.displayName}</td>
                <td>{u.username}</td>
                <td>{ROLE_LABEL[u.role]}</td>
                <td>{u.active ? 'Activo' : 'Desactivado'}</td>
                <td>
                  <button type="button" className="link-button" onClick={() => resetPin(u)}>
                    Cambiar PIN
                  </button>
                  {u.id !== me?.id && (
                    <button type="button" className="link-button" onClick={() => toggleActive(u)}>
                      {u.active ? 'Desactivar' : 'Activar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
