/**
 * Client Portal inbound status presentation — collapse warehouse statuses
 * into four customer-facing buckets.
 */

export type ClientInboundDisplayStatus =
  | 'pending_approval'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

const IN_PROGRESS_BACKEND: ReadonlySet<string> = new Set([
  'draft',
  'confirmed',
  'in_progress',
  'partially_received',
]);

/** Map a raw inbound status to one of the four client-facing statuses. */
export function mapClientInboundDisplayStatus(status: string): ClientInboundDisplayStatus {
  const s = status.trim().toLowerCase();
  if (s === 'pending_approval') return 'pending_approval';
  if (s === 'completed') return 'completed';
  if (s === 'cancelled') return 'cancelled';
  if (IN_PROGRESS_BACKEND.has(s)) return 'in_progress';
  return 'in_progress';
}

export function clientInboundStatusLabel(status: string, isArabic = false): string {
  const mapped = mapClientInboundDisplayStatus(status);
  const labels: Record<ClientInboundDisplayStatus, { en: string; ar: string }> = {
    pending_approval: { en: 'Waiting for approval', ar: 'بانتظار الموافقة' },
    in_progress: { en: 'In progress', ar: 'قيد التنفيذ' },
    completed: { en: 'Completed', ar: 'مكتمل' },
    cancelled: { en: 'Cancelled', ar: 'ملغي' },
  };
  return isArabic ? labels[mapped].ar : labels[mapped].en;
}

/** Backend statuses included when filtering by "In progress". */
export const CLIENT_INBOUND_IN_PROGRESS_STATUSES = [
  'draft',
  'confirmed',
  'in_progress',
  'partially_received',
] as const;
