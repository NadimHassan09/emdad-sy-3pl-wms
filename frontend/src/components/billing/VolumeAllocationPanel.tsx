import type { BillingCapacitySummary } from '../../api/billing';
import { formatDecimal, warehouseAllocationPercent } from '../../lib/billing-plan-overview';

type Props = {
  capacity: BillingCapacitySummary | undefined;
  reservedVolume?: string;
  reservedWeight?: string;
  loading?: boolean;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

export function VolumeAllocationPanel({ capacity, reservedVolume, reservedWeight, loading }: Props) {
  if (loading) {
    return <p className="text-sm text-slate-500">Loading volume allocation…</p>;
  }

  const allocPct = capacity
    ? warehouseAllocationPercent(capacity.allocatedVolumeCbm, capacity.totalWarehouseVolumeCbm)
    : '—';

  const overflowRemaining = capacity
    ? formatDecimal(capacity.remainingAllocatableCbm, 4)
    : '—';

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Volume allocation</h3>
      <p className="mt-1 text-xs text-slate-500">
        Up to {(capacity?.allocationRatio ?? 0.9) * 100}% of warehouse CBM may be reserved for clients; 10% remains
        as overflow capacity.
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Reserved volume (this plan)" value={`${formatDecimal(reservedVolume ?? '0', 4)} CBM`} />
        <Stat label="Reserved weight (this plan)" value={`${formatDecimal(reservedWeight ?? '0', 4)} kg`} />
        <Stat label="Warehouse allocation" value={allocPct} />
        <Stat label="Overflow capacity remaining" value={`${overflowRemaining} CBM`} />
      </dl>
      {capacity ? (
        <p className="mt-3 text-xs text-slate-500">
          Total warehouse: {formatDecimal(capacity.totalWarehouseVolumeCbm, 4)} CBM · Allocated across clients:{' '}
          {formatDecimal(capacity.allocatedVolumeCbm, 4)} CBM · Allocatable cap:{' '}
          {formatDecimal(capacity.allocatableCapacityCbm, 4)} CBM
        </p>
      ) : null}
    </section>
  );
}
