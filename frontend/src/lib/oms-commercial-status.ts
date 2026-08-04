/** OMS commercial lifecycle — display labels and legacy status collapse. */

export type OmsCommercialDisplayStatus =
  | 'pending_approval'
  | 'pending'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'returned_legacy';

const PENDING_LEGACY = new Set([
  'approved',
  'confirmed',
  'processing',
  'allocated',
  'picking',
  'packing',
  'ready_to_ship',
  'shipped',
  'failed_delivery',
  'draft',
]);

const EN_LABELS: Record<OmsCommercialDisplayStatus, string> = {
  pending_approval: 'Waiting for Approval',
  pending: 'Pending',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned_legacy: 'Returned (legacy)',
};

const AR_LABELS: Record<OmsCommercialDisplayStatus, string> = {
  pending_approval: 'بانتظار الموافقة',
  pending: 'قيد الانتظار',
  out_for_delivery: 'خارج للتسليم',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
  returned_legacy: 'مرتجع (قديم)',
};

/** Map raw backend status to a commercial display bucket. */
export function mapOmsCommercialDisplayStatus(status: string): OmsCommercialDisplayStatus {
  const s = status.trim().toLowerCase();
  if (s === 'pending_approval') return 'pending_approval';
  if (s === 'pending') return 'pending';
  if (s === 'out_for_delivery') return 'out_for_delivery';
  if (s === 'delivered' || s === 'completed') return 'delivered';
  if (s === 'cancelled' || s === 'rejected') return 'cancelled';
  if (s === 'returned') return 'returned_legacy';
  if (PENDING_LEGACY.has(s)) return 'pending';
  return 'pending';
}

export function omsCommercialStatusLabel(status: string, isArabic = false): string {
  const mapped = mapOmsCommercialDisplayStatus(status);
  return isArabic ? AR_LABELS[mapped] : EN_LABELS[mapped];
}

/** Badge meta key for StatusBadge tone lookup (normalized display key). */
export function omsCommercialStatusBadgeKey(status: string): string {
  const mapped = mapOmsCommercialDisplayStatus(status);
  if (mapped === 'returned_legacy') return 'returned';
  if (mapped === 'pending_approval') return 'pending approval';
  if (mapped === 'out_for_delivery') return 'out for delivery';
  return mapped.replace(/_/g, ' ');
}

export const OMS_COMMERCIAL_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending_approval', label: 'Waiting for Approval' },
  { value: 'pending', label: 'Pending' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export const OMS_COMMERCIAL_STATUS_COLORS: Record<string, string> = {
  pending_approval: '#f59e0b',
  pending: '#3b82f6',
  out_for_delivery: '#0891b2',
  delivered: '#15803d',
  cancelled: '#94a3b8',
  returned_legacy: '#ef4444',
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

/** Sum counts for statuses that display as commercial Pending. */
export function countCommercialPending(rows: Array<{ status: string; count: number }>): number {
  return rows
    .filter((r) => mapOmsCommercialDisplayStatus(r.status) === 'pending')
    .reduce((s, r) => s + r.count, 0);
}
