import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { OmsApi } from '../api/oms';
import { StatusBadge } from '../components/StatusBadge';
import { QK } from '../constants/query-keys';
import { Alert, AppPageHeader, Card, Skeleton } from '@ds';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card padding="md">
      <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-text-strong">{value}</div>
    </Card>
  );
}

export function OmsDashboardPage() {
  const dash = useQuery({
    queryKey: QK.omsDashboard,
    queryFn: () => OmsApi.dashboard(),
  });

  if (dash.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton height={48} width="40%" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} padding="md">
              <Skeleton height={14} width="60%" />
              <Skeleton height={32} width="40%" className="mt-3" />
            </Card>
          ))}
        </div>
      </div>
    );
  }
  if (dash.isError || !dash.data) {
    return (
      <Alert
        variant="error"
        title="Could not load OMS dashboard"
        description="There was a problem retrieving dashboard data. Try again."
      />
    );
  }

  const d = dash.data;

  return (
    <div className="space-y-4">
      <AppPageHeader
        title="OMS Dashboard"
        description="E-commerce order pipeline and COD snapshot"
        actions={
          <Link
            to="/orders/oms"
            className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-text-on-brand transition hover:bg-brand-700"
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
        <Card padding="md">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
            By status
          </h2>
          {(d.ordersByStatus ?? []).length === 0 ? (
            <p className="text-sm text-text-muted">No data.</p>
          ) : (
            <ul className="space-y-2">
              {(d.ordersByStatus ?? []).map((row) => (
                <li key={row.status} className="flex items-center justify-between gap-2 text-sm">
                  <StatusBadge status={row.status} />
                  <span className="font-medium text-text-body">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padding="md">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
            Recent orders
          </h2>
          {(d.recentOrders ?? []).length === 0 ? (
            <p className="text-sm text-text-muted">No recent orders.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {(d.recentOrders ?? []).map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div>
                    <Link
                      to={`/orders/oms/${row.id}`}
                      className="font-medium text-brand-700 hover:underline dark:text-brand-400"
                    >
                      {row.orderNumber}
                    </Link>
                    <div className="text-xs text-text-muted">
                      {row.recipientName ?? row.storeChannel ?? '—'}
                    </div>
                  </div>
                  <StatusBadge status={row.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
