interface StatusBadgeProps {
  status: string;
}

const STATUS_CLASS: Record<string, string> = {
  draft: 'badge-draft',
  approved: 'badge-complete',
  confirmed: 'badge-confirmed',
  in_progress: 'badge-progress',
  partially_received: 'badge-progress',
  picking: 'badge-progress',
  packing: 'badge-progress',
  ready_to_ship: 'badge-progress',
  pending_stock: 'badge-progress',
  completed: 'badge-complete',
  shipped: 'badge-shipped',
  cancelled: 'badge-cancelled',
  done: 'badge-complete',
  pending: 'badge-draft',
  assigned: 'badge-progress',
  failed: 'badge-cancelled',
  degraded: 'badge-cancelled',
  retry_pending: 'badge-progress',
  short: 'badge-cancelled',
  active: 'badge-complete',
  paused: 'badge-progress',
  offboarding: 'badge-progress',
  closed: 'badge-cancelled',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const cls = STATUS_CLASS[status] ?? 'badge-draft';
  return <span className={`badge ${cls}`}>{status.replace(/_/g, ' ')}</span>;
}
