/**
 * Status → visual meta map, matching the approved HTML reference
 * (`docs/ui-reference/client-portal-v2.html`) exactly for the statuses it
 * defines, extended with the additional backend status enums used across
 * inbound/outbound/OMS/returns/billing so every real status renders with a
 * sensible, consistent color.
 */
export type StatusMeta = {
  bg: string;
  text: string;
  border: string;
  dot: string;
};

export const statusMeta: Record<string, StatusMeta> = {
  draft: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  shipped: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  'in progress': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  'partially received': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  'pending approval': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  unpaid: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  active: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  success: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },

  // Extended backend statuses (not present in the reference HTML dataset).
  confirmed: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  allocated: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  picking: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  packing: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  'ready to ship': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  'out for delivery': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  delivered: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  'failed delivery': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  processing: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  returned: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  rejected: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  paid: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  overdue: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  suspended: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  archived: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' },
  open: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  collected: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  remitted: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  settled: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
};

/** Normalizes backend snake_case status enums (`pending_approval`) into the display key (`pending approval`). */
export function normalizeStatusKey(status: string): string {
  return status.replace(/_/g, ' ').trim().toLowerCase();
}

export function statusLabel(status: string, isArabic = false): string {
  const key = normalizeStatusKey(status);
  if (!isArabic) return key.replace(/\b\w/g, (c) => c.toUpperCase());
  const ar: Record<string, string> = {
    draft: 'مسودة',
    'pending approval': 'بانتظار الموافقة',
    approved: 'معتمد',
    confirmed: 'مؤكد',
    'in progress': 'قيد التنفيذ',
    'partially received': 'مستلم جزئياً',
    picking: 'التقاط',
    packing: 'تغليف',
    'ready to ship': 'جاهز للشحن',
    completed: 'مكتمل',
    shipped: 'تم الشحن',
    cancelled: 'ملغي',
    pending: 'قيد الانتظار',
    processing: 'قيد المعالجة',
    allocated: 'مخصص',
    'out for delivery': 'خارج للتسليم',
    delivered: 'تم التسليم',
    returned: 'مرتجع',
    rejected: 'مرفوض',
    'failed delivery': 'فشل التسليم',
    active: 'نشط',
    suspended: 'موقوف',
    archived: 'مؤرشف',
    open: 'مفتوحة',
    unpaid: 'غير مدفوعة',
    paid: 'مدفوعة',
    overdue: 'متأخرة',
    collected: 'تم التحصيل',
    remitted: 'محوّل',
    settled: 'مسوّى',
  };
  return ar[key] ?? key;
}
