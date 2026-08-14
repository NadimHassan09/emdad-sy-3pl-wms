/** Client Portal OMS commercial lifecycle labels (mirrors admin OMS). */

export type ClientOmsCommercialDisplayStatus =
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

const EN_LABELS: Record<ClientOmsCommercialDisplayStatus, string> = {
  waiting_for_confirmation: 'Waiting for Confirmation',
  confirmed_waiting_for_admin_approval: 'Confirmed — Waiting for Admin Approval',
  processing: 'Processing',
  ready_to_ship: 'Ready to Ship',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  failed_delivery: 'Failed Delivery',
  returned: 'Returned',
  legacy: 'Legacy',
};

const AR_LABELS: Record<ClientOmsCommercialDisplayStatus, string> = {
  waiting_for_confirmation: 'بانتظار التأكيد',
  confirmed_waiting_for_admin_approval: 'مؤكد — بانتظار موافقة الإدارة',
  processing: 'قيد المعالجة',
  ready_to_ship: 'جاهز للشحن',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
  failed_delivery: 'فشل التسليم',
  returned: 'مرتجع',
  legacy: 'قديم',
};

const LEGACY_TO_DISPLAY: Record<string, ClientOmsCommercialDisplayStatus> = {
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

export function mapClientOmsCommercialDisplayStatus(
  status: string,
): ClientOmsCommercialDisplayStatus {
  const s = status.trim().toLowerCase();
  if (s in EN_LABELS && s !== 'legacy') return s as ClientOmsCommercialDisplayStatus;
  if (LEGACY_TO_DISPLAY[s]) return LEGACY_TO_DISPLAY[s];
  return 'legacy';
}

export function clientOmsCommercialStatusLabel(status: string, isArabic = false): string {
  const mapped = mapClientOmsCommercialDisplayStatus(status);
  if (mapped === 'legacy') {
    const raw = status.trim() || 'unknown';
    return isArabic ? `قديم: ${raw}` : `Legacy: ${raw}`;
  }
  return isArabic ? AR_LABELS[mapped] : EN_LABELS[mapped];
}

export function clientOmsCommercialStatusBadgeKey(status: string): string {
  const mapped = mapClientOmsCommercialDisplayStatus(status);
  if (mapped === 'waiting_for_confirmation') return 'pending approval';
  if (mapped === 'confirmed_waiting_for_admin_approval') return 'pending approval';
  if (mapped === 'ready_to_ship') return 'ready to ship';
  if (mapped === 'failed_delivery') return 'failed delivery';
  if (mapped === 'legacy') return 'pending';
  return mapped.replace(/_/g, ' ');
}

export const CLIENT_OMS_COMMERCIAL_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'waiting_for_confirmation', label: 'Waiting for Confirmation' },
  {
    value: 'confirmed_waiting_for_admin_approval',
    label: 'Confirmed — Waiting for Admin Approval',
  },
  { value: 'processing', label: 'Processing' },
  { value: 'ready_to_ship', label: 'Ready to Ship' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed_delivery', label: 'Failed Delivery' },
  { value: 'returned', label: 'Returned' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;
