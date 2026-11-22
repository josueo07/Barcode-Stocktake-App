import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ErrorBanner } from '../components/common/ErrorBanner';

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await login(username.trim(), pin);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
      setPin('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <img className="login-icon" src="/icons/icon.svg" alt="" width={72} height={72} />
      <h1 className="large-title login-title">Inventario J&amp;R</h1>
      <p className="login-sub">Entra con tu usuario y tu PIN</p>
      <form className="card form-card login-form" onSubmit={handleSubmit}>
        <label className="field">
          Usuario
          <input
            autoComplete="username"
            autoCapitalize="none"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label className="field">
          PIN
          <input
            type="password"
            autoComplete="current-password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
          />
        </label>
        {error && <ErrorBanner message={error} />}
        <button type="submit" disabled={isSubmitting || !username.trim() || !pin}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
