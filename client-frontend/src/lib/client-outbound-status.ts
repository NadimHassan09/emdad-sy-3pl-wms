/**
 * Client Portal outbound status presentation — collapse warehouse statuses
 * into four customer-facing buckets.
 */

export type ClientOutboundDisplayStatus =
  | 'pending_approval'
  | 'in_progress'
  | 'shipped'
  | 'cancelled';

const IN_PROGRESS_BACKEND: ReadonlySet<string> = new Set([
  'draft',
  'pending_stock',
  'confirmed',
  'allocated',
  'picking',
  'packing',
  'ready_to_ship',
  'out_for_delivery',
  'returned',
]);

/** Map a raw outbound status to one of the four client-facing statuses. */
export function mapClientOutboundDisplayStatus(status: string): ClientOutboundDisplayStatus {
  const s = status.trim().toLowerCase();
  if (s === 'pending_approval') return 'pending_approval';
  if (s === 'shipped' || s === 'delivered') return 'shipped';
  if (s === 'cancelled') return 'cancelled';
  if (IN_PROGRESS_BACKEND.has(s)) return 'in_progress';
  return 'in_progress';
}

export function clientOutboundStatusLabel(status: string, isArabic = false): string {
  const mapped = mapClientOutboundDisplayStatus(status);
  const labels: Record<ClientOutboundDisplayStatus, { en: string; ar: string }> = {
    pending_approval: { en: 'Waiting for approval', ar: 'بانتظار الموافقة' },
    in_progress: { en: 'In progress', ar: 'قيد التنفيذ' },
    shipped: { en: 'Shipped', ar: 'تم الشحن' },
    cancelled: { en: 'Cancelled', ar: 'ملغي' },
  };
  return isArabic ? labels[mapped].ar : labels[mapped].en;
}

/** Backend statuses included when filtering by "In progress". */
export const CLIENT_OUTBOUND_IN_PROGRESS_STATUSES = [
  'draft',
  'pending_stock',
  'confirmed',
  'allocated',
  'picking',
  'packing',
  'ready_to_ship',
  'out_for_delivery',
  'returned',
] as const;
