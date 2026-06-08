import type { ClientInvoice, ClientInvoiceLine, ClientInvoiceLineType } from '../services/clientBillingService';

export type BillingRateSnapshot = {
  billingPlanId: string;
  fixedSubscriptionFee: string;
  inboundOrderFee: string;
  outboundOrderFee: string;
  packagingFee: string;
  qualityCheckFee: string;
  excessVolumeFeePerDay: string;
  excessWeightFeePerDay: string;
  reservedVolume: string;
  reservedWeight: string;
  snapshottedAt: string;
};

export function formatDecimal(value: string | number | null | undefined, digits = 2): string {
  if (value == null) return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatCycleLabel(cycle?: { startsAt: string; endsAt: string } | null): string {
  if (!cycle) return '—';
  return `${formatDate(cycle.startsAt)} – ${formatDate(cycle.endsAt)}`;
}

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

export function lineTotalByType(
  lines: ClientInvoiceLine[] | undefined,
  type: ClientInvoiceLineType,
): string {
  const line = lines?.find((l) => l.type === type);
  return line?.totalPrice ?? '0';
}

export function accountStatusLabel(status: string): string {
  if (status === 'restricted') return 'Restricted';
  if (status === 'expiring') return 'Expiring';
  return 'Active';
}

export function accountStatusClass(status: string): string {
  if (status === 'restricted') return 'badge badge-cancelled';
  if (status === 'expiring') return 'badge badge-progress';
  return 'badge badge-complete';
}

export function invoiceStatusClass(status: string): string {
  if (status === 'paid') return 'badge badge-complete';
  if (status === 'open') return 'badge badge-progress';
  if (status === 'cancelled') return 'badge badge-cancelled';
  return 'badge badge-draft';
}

export function humanizeInvoiceStatus(status: string): string {
  return status.replace(/_/g, ' ');
}

export function renewalStatusLabel(status?: string): string {
  if (!status) return 'Unknown';
  if (status === 'renewed') return 'Marked for renewal';
  if (status === 'active') return 'Active';
  if (status === 'expired') return 'Expired';
  return status;
}

export function isCurrentCycleInvoice(invoice: ClientInvoice, currentCycleId?: string | null): boolean {
  return !!currentCycleId && invoice.billingCycleId === currentCycleId;
}
