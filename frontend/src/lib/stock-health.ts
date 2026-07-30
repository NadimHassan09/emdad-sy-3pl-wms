/** Client/admin shared low-stock health helpers (mirrors backend low-stock.util). */

export type StockHealthStatus =
  | 'healthy'
  | 'low_stock'
  | 'critical'
  | 'out_of_stock'
  | null;

const CRITICAL_RATIO = 0.5;

export function normalizeThreshold(raw: number | string | null | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

export function stockHealthProgress(
  currentStock: number,
  threshold: number | string | null | undefined,
): number | null {
  const t = normalizeThreshold(threshold);
  if (t <= 0) return null;
  const stock = Number.isFinite(currentStock) ? Math.max(0, currentStock) : 0;
  if (stock >= t) return 100;
  return Math.round((stock / t) * 1000) / 10;
}

export function stockHealthStatus(
  currentStock: number,
  threshold: number | string | null | undefined,
): StockHealthStatus {
  const t = normalizeThreshold(threshold);
  if (t <= 0) return null;
  const stock = Number.isFinite(currentStock) ? currentStock : 0;
  if (stock <= 0) return 'out_of_stock';
  if (stock >= t) return 'healthy';
  if (stock / t < CRITICAL_RATIO) return 'critical';
  return 'low_stock';
}

export function stockHealthLabel(status: StockHealthStatus, isArabic = false): string {
  if (!status) return '—';
  if (!isArabic) {
    switch (status) {
      case 'healthy':
        return 'Healthy';
      case 'low_stock':
        return 'Low Stock';
      case 'critical':
        return 'Critical';
      case 'out_of_stock':
        return 'Out of Stock';
    }
  }
  switch (status) {
    case 'healthy':
      return 'سليم';
    case 'low_stock':
      return 'مخزون منخفض';
    case 'critical':
      return 'حرج';
    case 'out_of_stock':
      return 'نفد المخزون';
  }
}

export function stockHealthBarClass(status: StockHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'bg-emerald-500';
    case 'low_stock':
      return 'bg-amber-500';
    case 'critical':
      return 'bg-rose-500';
    case 'out_of_stock':
      return 'bg-rose-600';
    default:
      return 'bg-slate-300';
  }
}

export function stockHealthBadgeClass(status: StockHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'low_stock':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'critical':
      return 'bg-orange-50 text-orange-800 border-orange-200';
    case 'out_of_stock':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200';
  }
}
