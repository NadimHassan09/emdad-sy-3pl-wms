/**
 * Status → visual meta map shared by Admin Dashboard and Client Portal.
 * Soft tinted pill badges with a leading colored dot — theme-aware via the
 * `status-*` semantic Tailwind classes (see tailwind.preset.cjs), which
 * resolve to different concrete colors in light vs. dark mode automatically.
 */
export type StatusMeta = {
  bg: string;
  text: string;
  border: string;
  dot: string;
};

type Tone = 'neutral' | 'success' | 'danger' | 'info' | 'warning' | 'violet' | 'orange';

const TONE: Record<Tone, StatusMeta> = {
  neutral: { bg: 'bg-status-neutral-bg', text: 'text-status-neutral-fg', border: 'border-status-neutral-border', dot: 'bg-status-neutral-fg' },
  success: { bg: 'bg-status-success-bg', text: 'text-status-success-fg', border: 'border-status-success-border', dot: 'bg-status-success-fg' },
  danger:  { bg: 'bg-status-danger-bg', text: 'text-status-danger-fg', border: 'border-status-danger-border', dot: 'bg-status-danger-fg' },
  info:    { bg: 'bg-status-info-bg', text: 'text-status-info-fg', border: 'border-status-info-border', dot: 'bg-status-info-fg' },
  warning: { bg: 'bg-status-warning-bg', text: 'text-status-warning-fg', border: 'border-status-warning-border', dot: 'bg-status-warning-fg' },
  violet:  { bg: 'bg-status-violet-bg', text: 'text-status-violet-fg', border: 'border-status-violet-border', dot: 'bg-status-violet-fg' },
  orange:  { bg: 'bg-status-orange-bg', text: 'text-status-orange-fg', border: 'border-status-orange-border', dot: 'bg-status-orange-fg' },
};

const KEY_TONE: Record<string, Tone> = {
  draft: 'neutral',
  completed: 'success',
  cancelled: 'danger',
  shipped: 'info',
  'in progress': 'warning',
  'partially received': 'orange',
  'pending approval': 'warning',
  unpaid: 'danger',
  active: 'success',
  pending: 'warning',
  success: 'success',
  confirmed: 'info',
  allocated: 'warning',
  picking: 'warning',
  packing: 'warning',
  'ready to ship': 'info',
  'out for delivery': 'info',
  delivered: 'success',
  'failed delivery': 'danger',
  processing: 'warning',
  returned: 'orange',
  approved: 'success',
  rejected: 'danger',
  paid: 'success',
  overdue: 'danger',
  suspended: 'danger',
  archived: 'neutral',
  open: 'warning',
  collected: 'success',
  remitted: 'info',
  settled: 'success',
  done: 'success',
  assigned: 'violet',
  failed: 'danger',
  degraded: 'danger',
  'retry pending': 'warning',
  short: 'danger',
  'pending review': 'warning',
  scheduled: 'neutral',
  skipped: 'danger',
  counted: 'success',
  posted: 'success',
  receiving: 'warning',
  inspecting: 'warning',
  received: 'warning',
  'pending stock': 'warning',
  paused: 'warning',
  offboarding: 'warning',
  closed: 'danger',
  restricted: 'danger',
  purged: 'danger',
  billed: 'orange',
  inactive: 'neutral',
  expiring: 'warning',
  'low stock': 'orange',
};

export const statusMeta: Record<string, StatusMeta> = Object.fromEntries(
  Object.entries(KEY_TONE).map(([key, tone]) => [key, TONE[tone]]),
);

/** Normalizes backend snake_case status enums into display keys. */
export function normalizeStatusKey(status: string): string {
  return status.replace(/_/g, ' ').trim().toLowerCase();
}

export function statusLabel(status: string, isArabic = false): string {
  const key = normalizeStatusKey(status);
  if (!isArabic) {
    if (key === 'ready to ship') return 'Ready for Shipping';
    return key.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  const ar: Record<string, string> = {
    draft: 'مسودة',
    'pending approval': 'بانتظار الموافقة',
    approved: 'معتمد',
    confirmed: 'مؤكد',
    'in progress': 'قيد التنفيذ',
    'partially received': 'مستلم جزئياً',
    'ready to ship': 'جاهز للشحن',
    picking: 'التقاط',
    packing: 'تغليف',
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
    unpaid: 'غير مدفوعة',
    paid: 'مدفوعة',
    overdue: 'متأخرة',
    suspended: 'موقوف',
    archived: 'مؤرشف',
    open: 'مفتوحة',
    done: 'منجز',
    assigned: 'معين',
    failed: 'فشل',
    'pending stock': 'بانتظار المخزون',
    'pending review': 'بانتظار المراجعة',
    scheduled: 'مجدول',
    skipped: 'متخطى',
    counted: 'معد',
    posted: 'مرحّل',
    receiving: 'استلام',
    inspecting: 'فحص',
    received: 'مستلم',
    paused: 'متوقف مؤقتا',
    offboarding: 'إنهاء الخدمة',
    closed: 'مغلق',
    restricted: 'مقيّد',
    purged: 'محذوف نهائيا',
    billed: 'مفوتر',
    inactive: 'غير نشط',
    expiring: 'ينتهي قريباً',
    'low stock': 'مخزون منخفض',
  };
  return ar[key] ?? key;
}
