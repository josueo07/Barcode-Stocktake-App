import type {
  BatchScanResponse,
  LiveCount,
  ScanEvent,
  ScanSubmission,
  VarianceReport,
} from '@barcode-stocktake/shared';
import { getAuthToken } from '../auth/authStore';
import { config } from '../config';
import { httpClient } from './httpClient';

export function submitScan(
  sessionId: number,
  scan: ScanSubmission,
): Promise<{ status: 'accepted' | 'duplicate' | 'late' }> {
  return httpClient.post(`/api/sessions/${sessionId}/scans`, scan);
}

export function submitScanBatch(
  sessionId: number,
  scans: ScanSubmission[],
): Promise<BatchScanResponse> {
  return httpClient.post(`/api/sessions/${sessionId}/scans/batch`, { scans });
}

export function getCounts(sessionId: number): Promise<LiveCount[]> {
  return httpClient
    .get<{ counts: LiveCount[] }>(`/api/sessions/${sessionId}/counts`)
    .then((r) => r.counts);
}

export function voidScan(sessionId: number, scanId: number): Promise<void> {
  return httpClient.delete(`/api/sessions/${sessionId}/scans/${scanId}`);
}

export function listScans(sessionId: number): Promise<ScanEvent[]> {
  return httpClient
    .get<{ scans: ScanEvent[] }>(`/api/sessions/${sessionId}/scans`)
    .then((r) => r.scans);
}

export function getVarianceReport(sessionId: number): Promise<VarianceReport> {
  return httpClient
    .get<{ report: VarianceReport }>(`/api/sessions/${sessionId}/variance-report`)
    .then((r) => r.report);
}

export function varianceReportExportUrl(sessionId: number): string {
  return `${config.apiBaseUrl}/api/sessions/${sessionId}/variance-report/export`;
}

/**
 * Downloads the CSV. A plain <a href> can't send the login token, so fetch it with the
 * Authorization header and hand the browser a blob instead.
 */
export async function downloadVarianceReportCsv(sessionId: number): Promise<void> {
  const token = getAuthToken();
  const res = await fetch(varianceReportExportUrl(sessionId), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`No se pudo descargar el reporte (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = `reporte-diferencias-sesion-${sessionId}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function listLateScans(sessionId: number): Promise<ScanEvent[]> {
  return httpClient
    .get<{ scans: ScanEvent[] }>(`/api/sessions/${sessionId}/late-scans`)
    .then((r) => r.scans);
}

export function acceptLateScans(
  sessionId: number,
  scanIds: number[],
): Promise<{ accepted: number }> {
  return httpClient.post(`/api/sessions/${sessionId}/late-scans/accept`, { scanIds });
}
