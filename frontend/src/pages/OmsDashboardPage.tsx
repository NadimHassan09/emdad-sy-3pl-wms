import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { OmsApi } from '../api/oms';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { QK } from '../constants/query-keys';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export function OmsDashboardPage() {
  const dash = useQuery({
    queryKey: QK.omsDashboard,
    queryFn: () => OmsApi.dashboard(),
  });

  if (dash.isLoading) {
    return <p className="text-sm text-slate-500">Loading OMS dashboard…</p>;
  }
  if (dash.isError || !dash.data) {
    return <p className="text-sm text-rose-600">Could not load OMS dashboard.</p>;
  }

  const d = dash.data;

  return (
    <div className="space-y-4">
      <PageHeader
        icon="fa-store"
        title="OMS Dashboard"
        description="E-commerce order pipeline and COD snapshot"
        actions={
          <Link
            to="/orders/oms"
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            View OMS orders
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Orders today" value={d.ordersToday} />
        <StatCard label="Pending approval" value={d.pendingApproval ?? d.pendingOrders} />
        <StatCard label="Approved / allocated" value={d.approved ?? d.allocatedOrders} />
        <StatCard label="Picking" value={d.picking} />
        <StatCard label="Packing" value={d.packing} />
        <StatCard label="Out for delivery" value={d.outForDelivery} />
        <StatCard label="Delivered today" value={d.deliveredToday} />
        <StatCard label="Returns" value={d.returns} />
        <StatCard label="Cancelled" value={d.cancelled ?? 0} />
        <StatCard label="COD pending" value={d.codPending} />
        <StatCard label="COD collected" value={d.codCollected} />
        <StatCard label="Today's revenue" value={d.todaysRevenue ?? '—'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            By status
          </h2>
          {(d.ordersByStatus ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">No data.</p>
          ) : (
            <ul className="space-y-2">
              {(d.ordersByStatus ?? []).map((row) => (
                <li key={row.status} className="flex items-center justify-between gap-2 text-sm">
                  <StatusBadge status={row.status} />
                  <span className="font-medium text-slate-800">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Recent orders
          </h2>
          {(d.recentOrders ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">No recent orders.</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {(d.recentOrders ?? []).map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div>
                    <Link
                      to={`/orders/oms/${row.id}`}
                      className="font-medium text-emerald-700 hover:underline"
                    >
                      {row.orderNumber}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {row.recipientName ?? row.storeChannel ?? '—'}
                    </div>
                  </div>
                  <StatusBadge status={row.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
