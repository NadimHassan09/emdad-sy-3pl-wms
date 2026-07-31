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
      return 'bg-status-success-fg';
    case 'low_stock':
      return 'bg-status-warning-fg';
    case 'critical':
    case 'out_of_stock':
      return 'bg-status-danger-fg';
    default:
      return 'bg-border-strong';
  }
}

export function stockHealthBadgeClass(status: StockHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'bg-status-success-bg text-status-success-fg border-status-success-border';
    case 'low_stock':
      return 'bg-status-warning-bg text-status-warning-fg border-status-warning-border';
    case 'critical':
      return 'bg-status-orange-bg text-status-orange-fg border-status-orange-border';
    case 'out_of_stock':
      return 'bg-status-danger-bg text-status-danger-fg border-status-danger-border';
    default:
      return 'bg-status-neutral-bg text-status-neutral-fg border-status-neutral-border';
  }
}
