import type {
  CreateSessionInput,
  CsvImportSummary,
  ManualExpectedQuantityInput,
  SessionExpectedQuantity,
  StocktakeSession,
  UpdateSessionInput,
} from '@barcode-stocktake/shared';
import { httpClient } from './httpClient';

export function listSessions(): Promise<StocktakeSession[]> {
  return httpClient.get<{ sessions: StocktakeSession[] }>('/api/sessions').then((r) => r.sessions);
}

export function getSession(id: number): Promise<StocktakeSession> {
  return httpClient.get<{ session: StocktakeSession }>(`/api/sessions/${id}`).then((r) => r.session);
}

export function createSession(input: CreateSessionInput): Promise<StocktakeSession> {
  return httpClient.post<{ session: StocktakeSession }>('/api/sessions', input).then((r) => r.session);
}

export function updateSession(id: number, input: UpdateSessionInput): Promise<StocktakeSession> {
  return httpClient
    .patch<{ session: StocktakeSession }>(`/api/sessions/${id}`, input)
    .then((r) => r.session);
}

export function importSessionCsv(id: number, file: File): Promise<CsvImportSummary> {
  const formData = new FormData();
  formData.append('file', file);
  return httpClient
    .post<{ summary: CsvImportSummary }>(`/api/sessions/${id}/import-csv`, formData)
    .then((r) => r.summary);
}

export function listExpectedQuantities(id: number): Promise<SessionExpectedQuantity[]> {
  return httpClient
    .get<{ expectedQuantities: SessionExpectedQuantity[] }>(`/api/sessions/${id}/expected-quantities`)
    .then((r) => r.expectedQuantities);
}

export function addManualExpectedQuantity(
  id: number,
  input: ManualExpectedQuantityInput,
): Promise<{ productId: number; expectedQty: number }> {
  return httpClient.post(`/api/sessions/${id}/expected-quantities`, input);
}
