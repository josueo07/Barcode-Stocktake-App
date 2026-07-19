import type { SessionStatus } from '@barcode-stocktake/shared';

const LABELS: Record<SessionStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  completed: 'Completed',
};

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  return <span className={`status-badge status-badge--${status}`}>{LABELS[status]}</span>;
}
