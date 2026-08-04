/** Client Portal OMS commercial lifecycle labels (mirrors admin OMS). */

export type ClientOmsCommercialDisplayStatus =
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

const EN_LABELS: Record<ClientOmsCommercialDisplayStatus, string> = {
  pending_approval: 'Waiting for Approval',
  pending: 'Pending',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned_legacy: 'Returned (legacy)',
};

const AR_LABELS: Record<ClientOmsCommercialDisplayStatus, string> = {
  pending_approval: 'بانتظار الموافقة',
  pending: 'قيد الانتظار',
  out_for_delivery: 'خارج للتسليم',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
  returned_legacy: 'مرتجع (قديم)',
};

export function mapClientOmsCommercialDisplayStatus(
  status: string,
): ClientOmsCommercialDisplayStatus {
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

export function clientOmsCommercialStatusLabel(status: string, isArabic = false): string {
  const mapped = mapClientOmsCommercialDisplayStatus(status);
  return isArabic ? AR_LABELS[mapped] : EN_LABELS[mapped];
}

export function clientOmsCommercialStatusBadgeKey(status: string): string {
  const mapped = mapClientOmsCommercialDisplayStatus(status);
  if (mapped === 'returned_legacy') return 'returned';
  if (mapped === 'pending_approval') return 'pending approval';
  if (mapped === 'out_for_delivery') return 'out for delivery';
  return mapped.replace(/_/g, ' ');
}

export const CLIENT_OMS_COMMERCIAL_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending_approval', label: 'Waiting for Approval' },
  { value: 'pending', label: 'Pending' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;
