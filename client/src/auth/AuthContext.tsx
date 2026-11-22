import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthUser, LoginResponse } from '@barcode-stocktake/shared';
import { httpClient } from '../api/httpClient';
import { countAllPendingScans } from '../db/offlineQueue';
import { requestPersistentStorage } from '../lib/device';
import { AUTH_EXPIRED_EVENT, clearAuth, loadAuth, saveAuth } from './authStore';

export interface AuthContextValue {
  user: AuthUser | null;
  isSupervisor: boolean;
  login: (username: string, pin: string) => Promise<void>;
  /** Resolves false if the person chose to stay signed in because of unsent scans. */
  logout: () => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => loadAuth()?.user ?? null);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const login = useCallback(async (username: string, pin: string) => {
    const result = await httpClient.post<LoginResponse>('/api/auth/login', { username, pin });
    saveAuth(result);
    setUser(result.user);
    void requestPersistentStorage();
  }, []);

  const logout = useCallback(async () => {
    const pending = await countAllPendingScans(loadAuth()?.user.id).catch(() => 0);
    if (
      pending > 0 &&
      !window.confirm(
        `Tienes ${pending} escaneo(s) sin enviar. Se quedan guardados en este teléfono y se enviarán cuando vuelvas a entrar con tu usuario. ¿Salir de todos modos?`,
      )
    ) {
      return false;
    }
    try {
      await httpClient.post('/api/auth/logout');
    } catch {
      // Offline or already expired: signing out locally is what matters.
    }
    clearAuth();
    setUser(null);
    return true;
  }, []);

  const value = useMemo(
    () => ({ user, isSupervisor: user?.role === 'supervisor', login, logout }),
    [user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
