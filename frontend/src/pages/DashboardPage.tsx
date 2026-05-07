import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { DashboardApi } from '../api/dashboard';
import { PieChart, type PieSlice } from '../components/PieChart';
import { PageHeader } from '../components/PageHeader';
import { QK } from '../constants/query-keys';

const INBOUND_COLORS = ['#0ea5e9', '#22c55e', '#f59e0b'];
const OUTBOUND_COLORS = ['#6366f1', '#a855f7', '#14b8a6'];

const cards = [
  { to: '/inbound', title: 'Inbound', description: 'Receiving orders' },
  { to: '/outbound', title: 'Outbound', description: 'Shipping orders' },
  { to: '/inventory', title: 'Stock', description: 'On-hand by product' },
  { to: '/tasks', title: 'Tasks', description: 'Warehouse workflow tasks' },
] as const;

function toPieSlices(
  rows: { label: string; count: number }[],
  colors: string[],
): PieSlice[] {
  return rows.map((r, i) => ({
    label: r.label,
    count: r.count,
    color: colors[i % colors.length]!,
  }));
}

export function DashboardPage() {
  const chartsQuery = useQuery({
    queryKey: QK.dashboardOpenOrdersCharts,
    queryFn: () => DashboardApi.openOrdersCharts(),
  });

  const emptyCharts = { inbound: [] as { label: string; count: number }[], outbound: [] as { label: string; count: number }[] };
  const payload = chartsQuery.data ?? emptyCharts;
  const inboundSlices = toPieSlices(
    Array.isArray(payload.inbound) ? payload.inbound : [],
    INBOUND_COLORS,
  );
  const outboundSlices = toPieSlices(
    Array.isArray(payload.outbound) ? payload.outbound : [],
    OUTBOUND_COLORS,
  );

  const err = chartsQuery.error instanceof Error ? chartsQuery.error.message : null;

  return (
    <div>
      <PageHeader title="Dashboard" />

      {chartsQuery.isPending ? (
        <p className="mb-8 text-sm text-slate-500">Loading charts…</p>
      ) : chartsQuery.isError ? (
        <p className="mb-8 text-sm text-rose-600">
          {err ?? 'Could not load dashboard charts.'} Check that the API is running and you are signed in.
        </p>
      ) : (
        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          <PieChart title="Open inbound orders (New · Receive · Putaway)" slices={inboundSlices} />
          <PieChart title="Open outbound orders (Picking · Packing · Shipping)" slices={outboundSlices} />
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold text-slate-700">Shortcuts</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-primary-300 hover:bg-primary-50/40"
          >
            <h3 className="text-sm font-semibold text-slate-900">{c.title}</h3>
            <p className="mt-1 text-xs text-slate-500">{c.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
