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
    'outboundBaseFee',
    'outboundIncludedItems',
    'outboundAdditionalItemFee',
    'packagingFee',
    'qualityCheckFee',
    'excessVolumeFeePerDay',
    'excessWeightFeePerDay',
    'reservedVolume',
    'reservedWeight',
  ] as const;
  for (const key of keys) {
    if (key === 'outboundIncludedItems') {
      if (typeof o[key] !== 'number' && typeof o[key] !== 'string') return null;
      continue;
    }
    if (typeof o[key] !== 'string') return null;
  }
  return {
    billingPlanId: o.billingPlanId as string,
    fixedSubscriptionFee: o.fixedSubscriptionFee as string,
    inboundOrderFee: o.inboundOrderFee as string,
    outboundOrderFee: o.outboundOrderFee as string,
    outboundBaseFee:
      typeof o.outboundBaseFee === 'string' ? o.outboundBaseFee : (o.outboundOrderFee as string),
    outboundIncludedItems:
      typeof o.outboundIncludedItems === 'number'
        ? o.outboundIncludedItems
        : Number(o.outboundIncludedItems ?? 0),
    outboundAdditionalItemFee:
      typeof o.outboundAdditionalItemFee === 'string' ? o.outboundAdditionalItemFee : '0',
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
  if (status === 'unpaid') return 'Unpaid';
  if (status === 'open') return 'Unpaid';
  if (status === 'paid') return 'Paid';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'overdue') return 'Unpaid';
  return status;
}

export function invoiceStatusClass(status: string): string {
  if (status === 'paid') return 'badge badge-complete';
  if (status === 'unpaid' || status === 'open' || status === 'overdue') return 'badge badge-progress';
  if (status === 'cancelled') return 'badge badge-cancelled';
  return 'badge';
}

export function lineLabel(line: BillingInvoiceLineRow): string {
  if (line.description?.trim()) return line.description.trim();
  const labels: Record<string, string> = {
    subscription: 'Fixed subscription',
    inbound: 'Inbound orders',
    outbound: 'Outbound orders (tiered)',
    packaging: 'Packaging',
    quality_check: 'Quality check',
    excess_volume: 'Excess volume',
    excess_weight: 'Excess weight',
    manual: 'Manual charge',
    order_charge: 'Order charge (VAS)',
  };
  return labels[line.type] ?? line.type;
}

export function systemLines(lines: BillingInvoiceLineRow[] | undefined): BillingInvoiceLineRow[] {
  return (lines ?? []).filter((l) => l.lineSource === 'system');
}

export function manualLines(lines: BillingInvoiceLineRow[] | undefined): BillingInvoiceLineRow[] {
  return (lines ?? []).filter((l) => l.lineSource === 'manual');
}

export function orderChargeLines(lines: BillingInvoiceLineRow[] | undefined): BillingInvoiceLineRow[] {
  return (lines ?? []).filter((l) => l.lineSource === 'order');
}

export { formatDate, formatDecimal } from './billing-plan-overview';
