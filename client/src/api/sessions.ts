import type {
  CreateSessionInput,
  CsvImportSummary,
  ManualExpectedQuantityInput,
  SessionExpectedQuantity,
  StocktakeSession,
  UpdateSessionInput,
} from '@barcode-stocktake/shared';
import { cacheSessions, getCachedSession, getCachedSessions } from '../db/offlineQueue';
import { ApiError, httpClient } from './httpClient';

/** True when the request never got an answer (no Wi-Fi, server unreachable). */
function isNetworkFailure(err: unknown): boolean {
  return !(err instanceof ApiError);
}

/** Lists sessions, falling back to the last list this device saw when offline. */
export async function listSessions(): Promise<StocktakeSession[]> {
  try {
    const { sessions } = await httpClient.get<{ sessions: StocktakeSession[] }>('/api/sessions');
    await cacheSessions(sessions).catch(() => undefined);
    return sessions;
  } catch (err) {
    if (isNetworkFailure(err)) {
      const cached = await getCachedSessions().catch(() => []);
      if (cached.length > 0) return cached;
    }
    throw err;
  }
}

/** Loads a session, falling back to this device's saved copy when offline. */
export async function getSession(id: number): Promise<StocktakeSession> {
  try {
    const { session } = await httpClient.get<{ session: StocktakeSession }>(`/api/sessions/${id}`);
    await cacheSessions([session]).catch(() => undefined);
    return session;
  } catch (err) {
    if (isNetworkFailure(err)) {
      const cached = await getCachedSession(id).catch(() => undefined);
      if (cached) return cached;
    }
    throw err;
  }
}

export function createSession(input: CreateSessionInput): Promise<StocktakeSession> {
  return httpClient
    .post<{ session: StocktakeSession }>('/api/sessions', input)
    .then((r) => r.session);
}

export function updateSession(id: number, input: UpdateSessionInput): Promise<StocktakeSession> {
  return httpClient
    .patch<{ session: StocktakeSession }>(`/api/sessions/${id}`, input)
    .then((r) => r.session);
}

export function importSessionCsv(
  id: number,
  file: File,
  quantityColumn?: number,
): Promise<CsvImportSummary> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('requireQuantity', 'true');
  if (quantityColumn !== undefined) formData.append('quantityColumn', String(quantityColumn));
  return httpClient
    .post<{ summary: CsvImportSummary }>(`/api/sessions/${id}/import-csv`, formData)
    .then((r) => r.summary);
}

export function listExpectedQuantities(id: number): Promise<SessionExpectedQuantity[]> {
  return httpClient
    .get<{ expectedQuantities: SessionExpectedQuantity[] }>(
      `/api/sessions/${id}/expected-quantities`,
    )
    .then((r) => r.expectedQuantities);
}

export function addManualExpectedQuantity(
  id: number,
  input: ManualExpectedQuantityInput,
): Promise<{ productId: number; expectedQty: number }> {
  return httpClient.post(`/api/sessions/${id}/expected-quantities`, input);
}

export function deleteExpectedQuantity(sessionId: number, productId: number): Promise<void> {
  return httpClient.delete(`/api/sessions/${sessionId}/expected-quantities/${productId}`);
}

export function deleteSession(id: number): Promise<void> {
  return httpClient.delete(`/api/sessions/${id}?confirm=true`);
}
