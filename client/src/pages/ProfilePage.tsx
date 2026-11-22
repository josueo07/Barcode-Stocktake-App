import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { ProfileStats } from '@barcode-stocktake/shared';
import { changeMyPin, getMyStats, renameMe } from '../api/profile';
import { useAuth } from '../auth/AuthContext';
import { Avatar } from '../components/common/Avatar';

const ROLE_LABEL = { supervisor: 'Supervisor', counter: 'Contador' } as const;

function formatWhen(iso: string | null): string {
  if (!iso) return 'Todavía no';
  return new Intl.DateTimeFormat('es-PR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

export function ProfilePage() {
  const { user, isSupervisor, logout, updateCurrentUser } = useAuth();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [name, setName] = useState(user?.displayName ?? '');
  const [nameStatus, setNameStatus] = useState<string | null>(null);
  const [pins, setPins] = useState({ current: '', next: '', confirm: '' });
  const [pinStatus, setPinStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getMyStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  if (!user) return null;

  const handleRename = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim() === user.displayName) return;
    try {
      updateCurrentUser(await renameMe(name.trim()));
      setNameStatus('Nombre guardado.');
    } catch (err) {
      setNameStatus(err instanceof Error ? err.message : 'No se pudo guardar el nombre');
    }
  };

  const handlePin = async (e: FormEvent) => {
    e.preventDefault();
    if (pins.next.length < 6) {
      setPinStatus({ ok: false, text: 'El PIN nuevo debe tener al menos 6 caracteres.' });
      return;
    }
    if (pins.next !== pins.confirm) {
      setPinStatus({ ok: false, text: 'El PIN nuevo y la confirmación no coinciden.' });
      return;
    }
    setIsSaving(true);
    try {
      await changeMyPin(pins.current, pins.next);
      setPins({ current: '', next: '', confirm: '' });
      setPinStatus({
        ok: true,
        text: 'PIN cambiado. Los otros teléfonos tendrán que entrar de nuevo.',
      });
    } catch (err) {
      setPinStatus({ ok: false, text: err instanceof Error ? err.message : 'No se pudo cambiar' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page profile-page">
      <div className="profile-header">
        <Avatar name={user.displayName} size="lg" />
        <h1 className="profile-name">{user.displayName}</h1>
        <p className="profile-sub">
          @{user.username} ·{' '}
          <span className={`role-chip role-chip--${user.role}`}>{ROLE_LABEL[user.role]}</span>
        </p>
      </div>

      <h2 className="group-title">Mi actividad</h2>
      <div className="stat-grid">
        <div className="stat">
          <span className="stat-value">{stats?.scans ?? '—'}</span>
          <span className="stat-label">Escaneos</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats?.units ?? '—'}</span>
          <span className="stat-label">Unidades</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats?.sessions ?? '—'}</span>
          <span className="stat-label">Conteos</span>
        </div>
      </div>
      <p className="group-footer">Último escaneo: {formatWhen(stats?.lastScanAt ?? null)}</p>

      {isSupervisor && (
        <>
          <h2 className="group-title">Equipo</h2>
          <div className="list-group">
            <Link to="/users" className="list-row list-row--link">
              <span>Personas</span>
              <span className="list-row-detail">Supervisor y contadores</span>
            </Link>
          </div>
        </>
      )}

      <h2 className="group-title">Nombre</h2>
      <form className="card form-card" onSubmit={handleRename}>
        <label className="field">
          <span>Nombre que ven los demás</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </label>
        {nameStatus && <p className="form-note">{nameStatus}</p>}
        <button type="submit" disabled={!name.trim() || name.trim() === user.displayName}>
          Guardar nombre
        </button>
      </form>

      <h2 className="group-title">Cambiar PIN</h2>
      <form className="card form-card" onSubmit={handlePin}>
        <label className="field">
          <span>PIN actual</span>
          <input
            type="password"
            autoComplete="current-password"
            value={pins.current}
            onChange={(e) => setPins({ ...pins, current: e.target.value })}
          />
        </label>
        <label className="field">
          <span>PIN nuevo (mínimo 6)</span>
          <input
            type="password"
            autoComplete="new-password"
            value={pins.next}
            onChange={(e) => setPins({ ...pins, next: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Repite el PIN nuevo</span>
          <input
            type="password"
            autoComplete="new-password"
            value={pins.confirm}
            onChange={(e) => setPins({ ...pins, confirm: e.target.value })}
          />
        </label>
        {pinStatus && (
          <p
            className={pinStatus.ok ? 'form-note' : 'form-error'}
            role={pinStatus.ok ? undefined : 'alert'}
          >
            {pinStatus.text}
          </p>
        )}
        <button type="submit" disabled={isSaving || !pins.current || !pins.next}>
          {isSaving ? 'Guardando…' : 'Cambiar PIN'}
        </button>
      </form>

      <button type="button" className="button-destructive button-block" onClick={() => logout()}>
        Cerrar sesión
      </button>
    </div>
  );
}
