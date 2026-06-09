import type {
  BillingInvoiceLineRow,
  BillingInvoiceLineType,
  BillingInvoiceRow,
  BillingRateSnapshot,
} from '../api/billing';

export type InvoiceStatusFilter = '' | BillingInvoiceRow['status'];

export type InvoiceListFilters = {
  companyId: string;
  status: InvoiceStatusFilter;
  dateFrom: string;
  dateTo: string;
};

export function parseRateSnapshot(raw: unknown): BillingRateSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const keys = [
    'billingPlanId',
    'fixedSubscriptionFee',
    'inboundOrderFee',
    'outboundOrderFee',
    'packagingFee',
    'qualityCheckFee',
    'excessVolumeFeePerDay',
    'excessWeightFeePerDay',
    'reservedVolume',
    'reservedWeight',
  ] as const;
  for (const key of keys) {
    if (typeof o[key] !== 'string') return null;
  }
  return {
    billingPlanId: o.billingPlanId as string,
    fixedSubscriptionFee: o.fixedSubscriptionFee as string,
    inboundOrderFee: o.inboundOrderFee as string,
    outboundOrderFee: o.outboundOrderFee as string,
    packagingFee: o.packagingFee as string,
    qualityCheckFee: o.qualityCheckFee as string,
    excessVolumeFeePerDay: o.excessVolumeFeePerDay as string,
    excessWeightFeePerDay: o.excessWeightFeePerDay as string,
    reservedVolume: o.reservedVolume as string,
    reservedWeight: o.reservedWeight as string,
    snapshottedAt: typeof o.snapshottedAt === 'string' ? o.snapshottedAt : '',
  };
}

export function filterInvoiceRows(
  rows: BillingInvoiceRow[],
  filters: InvoiceListFilters,
): BillingInvoiceRow[] {
  return rows.filter((row) => {
    if (filters.companyId && row.companyId !== filters.companyId) return false;
    if (filters.status && row.status !== filters.status) return false;
    const created = new Date(row.createdAt);
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      if (created < from) return false;
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      if (created > to) return false;
    }
    return true;
  });
}

export function formatCycleLabel(cycle?: BillingInvoiceRow['billingCycle']): string {
  if (!cycle) return '—';
  const start = new Date(cycle.startsAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const end = new Date(cycle.endsAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${start} – ${end}`;
}

export function lineTotalByType(
  lines: BillingInvoiceLineRow[] | undefined,
  type: BillingInvoiceLineType,
): string {
  const line = lines?.find((l) => l.type === type);
  return line?.totalPrice ?? '0';
}

export function renewalStatusLabel(status?: string): string {
  if (!status) return 'Unknown';
  if (status === 'renewed') return 'Marked for renewal';
  if (status === 'active') return 'Active — not renewed';
  if (status === 'expired') return 'Expired';
  return status;
}

export function humanizeInvoiceStatus(status: string): string {
  if (status === 'draft') return 'Draft';
  if (status === 'open') return 'Open';
  if (status === 'paid') return 'Paid';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'overdue') return 'Overdue';
  return status;
}

export function invoiceStatusClass(status: string): string {
  if (status === 'paid') return 'badge badge-complete';
  if (status === 'open') return 'badge badge-progress';
  if (status === 'overdue') return 'badge badge-cancelled';
  if (status === 'cancelled') return 'badge badge-cancelled';
  return 'badge';
}

export { formatDate, formatDecimal } from './billing-plan-overview';
