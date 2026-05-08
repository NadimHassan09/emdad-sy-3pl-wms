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
  const isArabic =
    typeof document !== 'undefined' &&
    (document.documentElement.dir === 'rtl' || window.localStorage.getItem('wms-ui-language') === 'AR');
  const key = status.replace(/_/g, ' ');
  const ar: Record<string, string> = {
    draft: 'مسودة',
    approved: 'معتمد',
    confirmed: 'مؤكد',
    'in progress': 'قيد التنفيذ',
    'partially received': 'مستلم جزئيا',
    picking: 'التقاط',
    packing: 'تغليف',
    'ready to ship': 'جاهز للشحن',
    'pending stock': 'بانتظار المخزون',
    completed: 'مكتمل',
    shipped: 'تم الشحن',
    cancelled: 'ملغي',
    done: 'منجز',
    pending: 'قيد الانتظار',
    assigned: 'معين',
    failed: 'فشل',
    degraded: 'متدهور',
    'retry pending': 'بانتظار إعادة المحاولة',
    short: 'نقص',
    active: 'نشط',
    paused: 'متوقف مؤقتا',
    offboarding: 'إنهاء الخدمة',
    closed: 'مغلق',
  };
  return <span className={`badge ${cls}`}>{isArabic ? ar[key] ?? key : key}</span>;
}
