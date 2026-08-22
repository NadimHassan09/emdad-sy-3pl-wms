/** OMS commercial lifecycle — display labels and legacy status collapse. */

export type OmsCommercialDisplayStatus =
  | 'waiting_for_confirmation'
  | 'confirmed_waiting_for_admin_approval'
  | 'processing'
  | 'ready_to_ship'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'failed_delivery'
  | 'returned'
  | 'legacy';

const EN_LABELS: Record<OmsCommercialDisplayStatus, string> = {
  waiting_for_confirmation: 'Waiting for Confirmation',
  confirmed_waiting_for_admin_approval: 'Confirmed — Waiting for Admin Approval',
  processing: 'Processing',
  ready_to_ship: 'Ready for Shipping',
  shipped: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  failed_delivery: 'Failed Delivery',
  returned: 'Returned',
  legacy: 'Legacy',
};

const AR_LABELS: Record<OmsCommercialDisplayStatus, string> = {
  waiting_for_confirmation: 'بانتظار التأكيد',
  confirmed_waiting_for_admin_approval: 'مؤكد — بانتظار موافقة الإدارة',
  processing: 'قيد المعالجة',
  ready_to_ship: 'جاهز للشحن',
  shipped: 'خارج للتسليم',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
  failed_delivery: 'فشل التسليم',
  returned: 'مرتجع',
  legacy: 'قديم',
};

const LEGACY_TO_DISPLAY: Record<string, OmsCommercialDisplayStatus> = {
  pending_approval: 'confirmed_waiting_for_admin_approval',
  pending: 'processing',
  approved: 'processing',
  confirmed: 'processing',
  allocated: 'processing',
  picking: 'processing',
  packing: 'processing',
  out_for_delivery: 'shipped',
  completed: 'delivered',
  rejected: 'cancelled',
  draft: 'legacy',
};

/** Map raw backend status to a commercial display bucket. */
export function mapOmsCommercialDisplayStatus(status: string): OmsCommercialDisplayStatus {
  const s = status.trim().toLowerCase();
  if (s in EN_LABELS && s !== 'legacy') return s as OmsCommercialDisplayStatus;
  if (LEGACY_TO_DISPLAY[s]) return LEGACY_TO_DISPLAY[s];
  return 'legacy';
}

export function omsCommercialStatusLabel(status: string, isArabic = false): string {
  const mapped = mapOmsCommercialDisplayStatus(status);
  if (mapped === 'legacy') {
    const raw = status.trim() || 'unknown';
    return isArabic ? `قديم: ${raw}` : `Legacy: ${raw}`;
  }
  return isArabic ? AR_LABELS[mapped] : EN_LABELS[mapped];
}

/** Badge meta key for StatusBadge tone lookup (normalized display key). */
export function omsCommercialStatusBadgeKey(status: string): string {
  const mapped = mapOmsCommercialDisplayStatus(status);
  if (mapped === 'waiting_for_confirmation') return 'pending approval';
  if (mapped === 'confirmed_waiting_for_admin_approval') return 'pending approval';
  if (mapped === 'ready_to_ship') return 'ready to ship';
  if (mapped === 'shipped') return 'out for delivery';
  if (mapped === 'failed_delivery') return 'failed delivery';
  if (mapped === 'legacy') return 'pending';
  return mapped.replace(/_/g, ' ');
}

export const OMS_COMMERCIAL_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'waiting_for_confirmation', label: 'Waiting for Confirmation' },
  {
    value: 'confirmed_waiting_for_admin_approval',
    label: 'Confirmed — Waiting for Admin Approval',
  },
  { value: 'processing', label: 'Processing' },
  { value: 'ready_to_ship', label: 'Ready for Shipping' },
  { value: 'shipped', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed_delivery', label: 'Failed Delivery' },
  { value: 'returned', label: 'Returned' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export const OMS_COMMERCIAL_STATUS_COLORS: Record<string, string> = {
  waiting_for_confirmation: '#f59e0b',
  confirmed_waiting_for_admin_approval: '#f97316',
  processing: '#3b82f6',
  ready_to_ship: '#0ea5e9',
  shipped: '#0891b2',
  delivered: '#15803d',
  failed_delivery: '#dc2626',
  returned: '#ef4444',
  cancelled: '#94a3b8',
  legacy: '#64748b',
};

/** Aggregate raw status counts into commercial buckets for charts. */
export function aggregateCommercialStatusCounts(
  rows: Array<{ status: string; count: number }>,
): Array<{ status: OmsCommercialDisplayStatus; count: number }> {
  const totals = new Map<OmsCommercialDisplayStatus, number>();
  for (const row of rows) {
    const key = mapOmsCommercialDisplayStatus(row.status);
    totals.set(key, (totals.get(key) ?? 0) + row.count);
  }
  return Array.from(totals.entries()).map(([status, count]) => ({ status, count }));
}

/** Sum counts for statuses that display as commercial Processing. */
export function countCommercialPending(rows: Array<{ status: string; count: number }>): number {
  return rows
    .filter((r) => mapOmsCommercialDisplayStatus(r.status) === 'processing')
    .reduce((s, r) => s + r.count, 0);
}
