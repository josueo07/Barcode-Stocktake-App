import type { AuthUser } from '@barcode-stocktake/shared';

/**
 * Persists the login on the device so a counter can reopen the app mid-count (even offline)
 * without signing in again. The token itself is validated by the server on every request.
 */
const STORAGE_KEY = 'stocktake.auth';
export const AUTH_EXPIRED_EVENT = 'stocktake:auth-expired';

export interface StoredAuth {
  token: string;
  user: AuthUser;
  expiresAt: string;
}

let memory: StoredAuth | null = null;

export function loadAuth(): StoredAuth | null {
  if (memory) return memory;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed?.token || !parsed?.user) return null;
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() <= Date.now()) {
      clearAuth();
      return null;
    }
    memory = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export function saveAuth(auth: StoredAuth): void {
  memory = auth;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  } catch {
    // Storage unavailable (private mode); the login still works for this page load.
  }
}

export function clearAuth(): void {
  memory = null;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getAuthToken(): string | null {
  return loadAuth()?.token ?? null;
}
