import type { BillingCapacitySummary, CompanyStorageSummary } from '../../api/billing';
import { formatDecimal } from '../../lib/billing-plan-overview';

type Props = {
  capacity?: BillingCapacitySummary;
  storage?: CompanyStorageSummary;
  /** Fallback reserved volume when company storage not loaded yet */
  reservedVolume?: string;
  loading?: boolean;
  title?: string;
  description?: string;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-sunken px-4 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-text-strong">{value}</dd>
    </div>
  );
}

/**
 * Inventory-based storage utilization (product CBM × on-hand qty).
 * Does not use warehouse location/rack/bin dimensions.
 */
export function VolumeAllocationPanel({
  capacity,
  storage,
  reservedVolume,
  loading,
  title = 'Storage utilization',
  description = 'Used storage is calculated from current inventory quantity × product volume (CBM). Location dimensions are not used for billing.',
}: Props) {
  if (loading) {
    return <p className="text-sm text-text-muted">Loading storage utilization…</p>;
  }

  const used = storage?.usedStorageCbm ?? capacity?.usedStorageCbm ?? capacity?.allocatedVolumeCbm ?? '0';
  const reserved =
    storage?.reservedStorageCbm ??
    capacity?.reservedStorageCbm ??
    reservedVolume ??
    capacity?.totalWarehouseVolumeCbm ??
    '0';
  const remaining =
    storage?.remainingStorageCbm ?? capacity?.remainingStorageCbm ?? capacity?.remainingAllocatableCbm ?? '0';
  const utilization =
    storage?.storageUsagePercent ?? capacity?.storageUsagePercent ?? 0;

  return (
    <section className="rounded-lg border border-border bg-surface-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-text-strong">{title}</h3>
      <p className="mt-1 text-xs text-text-muted">{description}</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Reserved Storage" value={`${formatDecimal(reserved, 4)} CBM`} />
        <Stat label="Used Storage" value={`${formatDecimal(used, 4)} CBM`} />
        <Stat label="Remaining Storage" value={`${formatDecimal(remaining, 4)} CBM`} />
        <Stat label="Storage Utilization" value={`${Number(utilization).toFixed(1)}%`} />
      </dl>
    </section>
  );
}
