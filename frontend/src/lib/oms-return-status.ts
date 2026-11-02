import type { OmsReturn } from '../api/oms';

export const RETURN_STATUS_TONE: Record<string, 'warning' | 'brand' | 'danger' | 'success' | 'neutral'> = {
  requested: 'warning',
  approved: 'brand',
  completed: 'success',
  cancelled: 'neutral',
  rejected: 'danger',
};

export function getReturnStatusOptions(isArabic: boolean): { value: string; label: string }[] {
  return [
    { value: '', label: isArabic ? 'جميع الحالات' : 'All statuses' },
    { value: 'requested', label: isArabic ? 'مرتجع بانتظار الاستلام' : 'Return Pending Receipt' },
    { value: 'approved', label: isArabic ? 'معتمد (بانتظار الاستلام)' : 'Approved (Awaiting Receipt)' },
    { value: 'completed', label: isArabic ? 'مرتجع مستلم' : 'Return Received' },
    { value: 'cancelled', label: isArabic ? 'ملغي' : 'Cancelled' },
    { value: 'rejected', label: isArabic ? 'مرفوض' : 'Rejected' },
  ];
}

export function getReturnStatusDisplay(
  status: OmsReturn['status'] | string | null | undefined,
  isArabic: boolean,
): string {
  if (!status) return '—';
  const map: Record<string, { ar: string; en: string }> = {
    requested: { ar: 'مرتجع بانتظار الاستلام', en: 'Return Pending Receipt' },
    approved: { ar: 'معتمد (بانتظار الاستلام)', en: 'Approved' },
    completed: { ar: 'مرتجع مستلم', en: 'Return Received' },
    cancelled: { ar: 'ملغي', en: 'Cancelled' },
    rejected: { ar: 'مرفوض', en: 'Rejected' },
  };
  const item = map[status];
  if (!item) return status.replace(/_/g, ' ');
  return isArabic ? item.ar : item.en;
}
