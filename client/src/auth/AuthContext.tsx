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
import { AUTH_EXPIRED_EVENT, clearAuth, loadAuth, saveAuth } from './authStore';

export interface AuthContextValue {
  user: AuthUser | null;
  isSupervisor: boolean;
  login: (username: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
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
  }, []);

  const logout = useCallback(async () => {
    try {
      await httpClient.post('/api/auth/logout');
    } catch {
      // Offline or already expired: signing out locally is what matters.
    }
    clearAuth();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isSupervisor: user?.role === 'supervisor', login, logout }),
    [user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
