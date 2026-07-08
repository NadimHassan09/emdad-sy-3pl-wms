import { useQuery } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import { OmsApi } from '../api/oms';
import { PageHeader } from '../components/PageHeader';

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value.toLocaleString()}</div>
    </div>
  );
}

export function OmsDashboardPage(): ReactElement {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['oms', 'dashboard'] as const,
    queryFn: () => OmsApi.dashboard(),
  });

  return (
    <div className="space-y-4">
      <PageHeader title="OMS Dashboard" />
      {isLoading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {isError ? <p className="text-sm text-rose-600">Could not load OMS dashboard.</p> : null}
      {data ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Orders today" value={data.ordersToday} />
          <StatCard label="Pending orders" value={data.pendingOrders} />
          <StatCard label="Allocated" value={data.allocatedOrders} />
          <StatCard label="Picking" value={data.picking} />
          <StatCard label="Packing" value={data.packing} />
          <StatCard label="Out for delivery" value={data.outForDelivery} />
          <StatCard label="Delivered today" value={data.deliveredToday} />
          <StatCard label="COD pending" value={data.codPending} />
          <StatCard label="COD collected" value={data.codCollected} />
          <StatCard label="COD settled" value={data.codSettled} />
          <StatCard label="Returns" value={data.returns} />
        </div>
      ) : null}
    </div>
  );
}
