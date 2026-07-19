import type {
  BatchScanResponse,
  LiveCount,
  ScanEvent,
  ScanSubmission,
  VarianceReport,
} from '@barcode-stocktake/shared';
import { config } from '../config';
import { httpClient } from './httpClient';

export function submitScan(
  sessionId: number,
  scan: ScanSubmission,
): Promise<{ status: 'accepted' | 'duplicate' }> {
  return httpClient.post(`/api/sessions/${sessionId}/scans`, scan);
}

export function submitScanBatch(sessionId: number, scans: ScanSubmission[]): Promise<BatchScanResponse> {
  return httpClient.post(`/api/sessions/${sessionId}/scans/batch`, { scans });
}

export function getCounts(sessionId: number): Promise<LiveCount[]> {
  return httpClient.get<{ counts: LiveCount[] }>(`/api/sessions/${sessionId}/counts`).then((r) => r.counts);
}

export function voidScan(sessionId: number, scanId: number): Promise<void> {
  return httpClient.delete(`/api/sessions/${sessionId}/scans/${scanId}`);
}

export function listScans(sessionId: number): Promise<ScanEvent[]> {
  return httpClient.get<{ scans: ScanEvent[] }>(`/api/sessions/${sessionId}/scans`).then((r) => r.scans);
}

export function getVarianceReport(sessionId: number): Promise<VarianceReport> {
  return httpClient
    .get<{ report: VarianceReport }>(`/api/sessions/${sessionId}/variance-report`)
    .then((r) => r.report);
}

export function varianceReportExportUrl(sessionId: number): string {
  return `${config.apiBaseUrl}/api/sessions/${sessionId}/variance-report/export`;
}
