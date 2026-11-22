import type { SessionStatus } from '@barcode-stocktake/shared';

const LABELS: Record<SessionStatus, string> = {
  draft: 'Borrador',
  active: 'En curso',
  completed: 'Cerrado',
};

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  return <span className={`status-badge status-badge--${status}`}>{LABELS[status]}</span>;
}
