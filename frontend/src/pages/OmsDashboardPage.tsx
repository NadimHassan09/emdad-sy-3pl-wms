import { useQuery } from '@tanstack/react-query';
import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Alert, Card, Skeleton } from '@ds';

import type { OmsDashboardSummary } from '../api/oms';
import { OmsApi } from '../api/oms';
import { AdminListPageShell } from '../components/AdminListPageShell';
import { OmsStatusBadge } from '../components/oms/OmsStatusBadge';
import { QK } from '../constants/query-keys';
import {
  aggregateCommercialStatusCounts,
  countCommercialPending,
  OMS_COMMERCIAL_STATUS_COLORS,
  omsCommercialStatusLabel,
} from '../lib/oms-commercial-status';

function fmtMoney(value: string | number | null | undefined, currency = 'SYP'): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.length === 3 ? currency : 'SYP',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n.toLocaleString()} ${currency}`;
  }
}

function fmtPct(trend: number | null | undefined): { text: string; up: boolean | null } {
  if (trend == null) return { text: 'vs yesterday', up: null };
  if (trend === 0) return { text: '0% vs yesterday', up: null };
  const up = trend > 0;
  return { text: `${up ? '↑' : '↓'} ${Math.abs(trend)}% vs yesterday`, up };
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function eventLabel(ev: NonNullable<OmsDashboardSummary['liveActivity']>[number]): string {
  const order = ev.orderNumber ? `Order ${ev.orderNumber}` : 'Order';
  const by = ev.actorName ? ` by ${ev.actorName}` : '';
  const t = ev.eventType.replace(/^order\./, '').replace(/_/g, ' ');
  return `${order} ${t}${by}`;
}

function eventIcon(eventType: string): { icon: string; tone: string } {
  if (eventType.includes('approved')) {
    return { icon: 'fa-check', tone: 'bg-emerald-100 text-emerald-700' };
  }
  if (eventType.includes('packed') || eventType.includes('packing')) {
    return { icon: 'fa-box', tone: 'bg-violet-100 text-violet-700' };
  }
  if (eventType.includes('pick')) {
    return { icon: 'fa-boxes-stacked', tone: 'bg-blue-100 text-blue-700' };
  }
  if (eventType.includes('cod') || eventType.includes('collected')) {
    return { icon: 'fa-money-bill', tone: 'bg-sky-100 text-sky-700' };
  }
  if (eventType.includes('deliver') || eventType.includes('ship')) {
    return { icon: 'fa-truck', tone: 'bg-cyan-100 text-cyan-700' };
  }
  if (eventType.includes('cancel') || eventType.includes('reject')) {
    return { icon: 'fa-xmark', tone: 'bg-rose-100 text-rose-700' };
  }
  if (eventType.includes('created')) {
    return { icon: 'fa-plus', tone: 'bg-emerald-100 text-emerald-700' };
  }
  return { icon: 'fa-bell', tone: 'bg-slate-100 text-slate-600' };
}

const STATUS_COLORS = OMS_COMMERCIAL_STATUS_COLORS;

function statusLabel(status: string): string {
  return omsCommercialStatusLabel(status);
}

type DonutSlice = { label: string; count: number; color: string };

function DonutChart({
  title,
  slices,
  emptyHint = 'No data yet.',
}: {
  title: string;
  slices: DonutSlice[];
  emptyHint?: string;
}) {
  const total = slices.reduce((s, x) => s + x.count, 0);
  const size = 148;
  const cx = size / 2;
  const cy = size / 2;
  const r = 54;
  const stroke = 22;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  const arcs =
    total <= 0
      ? null
      : slices.map((sl) => {
          const len = (sl.count / total) * circ;
          const el = (
            <circle
              key={sl.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={sl.color}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            >
              <title>{`${sl.label}: ${sl.count}`}</title>
            </circle>
          );
          offset += len;
          return el;
        });

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-white p-4 shadow-sm dark:bg-surface-card">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-strong">
        <i className="fa-solid fa-chart-pie text-xs text-brand-600" aria-hidden />
        {title}
      </h2>
      <div className="flex min-w-0 flex-1 flex-col items-center gap-4">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="block max-w-full -rotate-90"
            role="img"
            aria-label={title}
          >
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="var(--border-subtle, #e2e8f0)"
              strokeWidth={stroke}
            />
            {arcs}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex rotate-0 flex-col items-center justify-center">
            <span className="text-lg font-bold tabular-nums text-text-strong">
              {total > 0 ? total.toLocaleString() : '—'}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
              total
            </span>
          </div>
        </div>
        {total === 0 ? (
          <p className="text-center text-xs text-text-muted">{emptyHint}</p>
        ) : (
          <ul className="w-full min-w-0 space-y-1.5">
            {slices.map((sl) => {
              const pct = Math.round((sl.count / total) * 100);
              return (
                <li key={sl.label} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: sl.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-text-body">{sl.label}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-text-strong">
                    {pct}%
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Sparkline({
  values,
  stroke = '#16a34a',
}: {
  values: number[];
  stroke?: string;
}) {
  const w = 140;
  const h = 40;
  if (values.length < 2) {
    return <div className="h-10 w-[8.75rem]" />;
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 6) - 3;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="max-w-full overflow-visible" aria-hidden>
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2.25"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts}
      />
    </svg>
  );
}

function DualLineChart({
  days,
}: {
  days: Array<{ day: string; count: number; revenue: number }>;
}) {
  const w = 520;
  const h = 220;
  const pad = { t: 16, r: 48, b: 32, l: 36 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  if (days.length === 0) {
    return <p className="py-10 text-center text-sm text-text-muted">No trend data yet.</p>;
  }
  const maxOrders = Math.max(...days.map((d) => d.count), 1);
  const maxRev = Math.max(...days.map((d) => d.revenue), 1);
  const xAt = (i: number) =>
    pad.l + (days.length === 1 ? innerW / 2 : (i / (days.length - 1)) * innerW);
  const yOrders = (v: number) => pad.t + innerH - (v / maxOrders) * innerH;
  const yRev = (v: number) => pad.t + innerH - (v / maxRev) * innerH;
  const ordersPts = days.map((d, i) => `${xAt(i)},${yOrders(d.count)}`).join(' ');
  const revPts = days.map((d, i) => `${xAt(i)},${yRev(d.revenue)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full max-w-full" role="img" aria-label="Orders trend">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const y = pad.t + innerH * (1 - f);
        return (
          <line
            key={f}
            x1={pad.l}
            x2={w - pad.r}
            y1={y}
            y2={y}
            stroke="#e2e8f0"
            strokeWidth="1"
          />
        );
      })}
      <polyline fill="none" stroke="#3b82f6" strokeWidth="2.5" points={revPts} />
      <polyline fill="none" stroke="#16a34a" strokeWidth="2.5" points={ordersPts} />
      {days.map((d, i) => (
        <g key={d.day}>
          <circle cx={xAt(i)} cy={yOrders(d.count)} r="3.5" fill="#16a34a" />
          <circle cx={xAt(i)} cy={yRev(d.revenue)} r="3.5" fill="#3b82f6" />
          <text x={xAt(i)} y={h - 10} textAnchor="middle" fill="#64748b" style={{ fontSize: 10 }}>
            {d.day.slice(5)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function KpiCard({
  icon,
  iconTone,
  cardTone,
  label,
  value,
  trend,
}: {
  icon: string;
  iconTone: string;
  cardTone: string;
  label: string;
  value: ReactNode;
  trend?: number | null;
}) {
  const t = fmtPct(trend);
  return (
    <div
      className={`min-w-0 overflow-hidden rounded-xl border border-transparent p-4 shadow-sm ${cardTone}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconTone}`}
        >
          <i className={`fa-solid ${icon} text-sm`} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-slate-600 dark:text-text-muted">{label}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-text-strong">
            {value}
          </div>
          <div
            className={`mt-1 text-xs font-semibold ${
              t.up === true
                ? 'text-emerald-600'
                : t.up === false
                  ? 'text-rose-600'
                  : 'text-slate-500'
            }`}
          >
            {t.text}
          </div>
        </div>
      </div>
    </div>
  );
}

function FinanceCard({
  icon,
  iconTone,
  cardTone,
  label,
  value,
  trend,
  spark,
  stroke,
}: {
  icon: string;
  iconTone: string;
  cardTone: string;
  label: string;
  value: string;
  trend?: number | null;
  spark: number[];
  stroke: string;
}) {
  const t = fmtPct(trend);
  return (
    <div
      className={`min-w-0 overflow-hidden rounded-xl border border-transparent p-4 shadow-sm ${cardTone}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconTone}`}
          >
            <i className={`fa-solid ${icon} text-sm`} aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-600 dark:text-text-muted">{label}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-text-strong">
              {value}
            </div>
            <div
              className={`mt-1 text-xs font-semibold ${
                t.up === true
                  ? 'text-emerald-600'
                  : t.up === false
                    ? 'text-rose-600'
                    : 'text-slate-500'
              }`}
            >
              {t.text}
            </div>
          </div>
        </div>
        <Sparkline values={spark} stroke={stroke} />
      </div>
    </div>
  );
}

function customerInitials(name: string | null | undefined): string {
  const parts = (name ?? '?').trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

const AVATAR_TONES = [
  'bg-emerald-100 text-emerald-800',
  'bg-sky-100 text-sky-800',
  'bg-violet-100 text-violet-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
];

export function OmsDashboardPage() {
  const dash = useQuery({
    queryKey: QK.omsDashboard,
    queryFn: () => OmsApi.dashboard(),
  });

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        to="/orders/oms/new"
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
      >
        <i className="fa-solid fa-plus text-xs" aria-hidden />
        New OMS Order
      </Link>
      <Link
        to="/orders/oms"
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-text-strong hover:bg-surface-sunken dark:bg-surface-card"
      >
        View orders
      </Link>
      <button
        type="button"
        onClick={() => void dash.refetch()}
        className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-border bg-white text-text-muted hover:bg-surface-sunken hover:text-text-strong dark:bg-surface-card"
        title="Refresh"
        aria-label="Refresh dashboard"
      >
        <i className={`fa-solid fa-rotate ${dash.isFetching ? 'fa-spin' : ''}`} aria-hidden />
      </button>
    </div>
  );

  const d = dash.data;
  const trends = d?.trends;

  const trendDays = useMemo(() => {
    return (d?.ordersPerDay ?? []).map((row) => ({
      day: row.day,
      count: row.count,
      revenue: Number(row.revenue ?? 0),
      codPending: Number(row.codPending ?? 0),
      codCollected: Number(row.codCollected ?? 0),
    }));
  }, [d?.ordersPerDay]);

  const statusSlices: DonutSlice[] = useMemo(() => {
    const rows = aggregateCommercialStatusCounts(d?.ordersByStatus ?? []);
    return rows
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)
      .map((r) => ({
        label: statusLabel(r.status),
        count: r.count,
        color: STATUS_COLORS[r.status] ?? '#64748b',
      }));
  }, [d?.ordersByStatus]);

  const codSlices: DonutSlice[] = useMemo(() => {
    const pending = Number(d?.codPendingAmount ?? 0);
    const collected = Number(d?.codCollectedAmount ?? 0);
    const pendingFallback = pending > 0 ? pending : d?.codPending || 0;
    const collectedFallback = collected > 0 ? collected : d?.codCollected || 0;
    return [
      { label: 'Collected', count: collectedFallback, color: '#16a34a' },
      { label: 'Pending', count: pendingFallback, color: '#f59e0b' },
    ].filter((s) => s.count > 0);
  }, [d]);

  if (dash.isLoading) {
    return (
      <AdminListPageShell
        icon="fa-gauge-high"
        title="OMS Dashboard"
        subtitle="E-commerce order pipeline and COD snapshot."
        actions={headerActions}
        showSectionNav
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} padding="md">
              <Skeleton height={72} />
            </Card>
          ))}
        </div>
      </AdminListPageShell>
    );
  }

  if (dash.isError || !d) {
    return (
      <AdminListPageShell
        icon="fa-gauge-high"
        title="OMS Dashboard"
        subtitle="E-commerce order pipeline and COD snapshot."
        actions={headerActions}
        showSectionNav
      >
        <Alert
          variant="error"
          title="Could not load OMS dashboard"
          description="There was a problem retrieving dashboard data. Try again."
        />
      </AdminListPageShell>
    );
  }

  return (
    <AdminListPageShell
      icon="fa-gauge-high"
      title="OMS Dashboard"
      subtitle="E-commerce order pipeline and COD snapshot."
      actions={headerActions}
      showSectionNav
    >
      {/* KPI row — tinted cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          icon="fa-cart-shopping"
          iconTone="bg-emerald-500 text-white"
          cardTone="bg-emerald-50 dark:bg-emerald-950/30"
          label="Today's orders"
          value={d.ordersToday}
          trend={trends?.ordersToday}
        />
        <KpiCard
          icon="fa-clock"
          iconTone="bg-amber-500 text-white"
          cardTone="bg-amber-50 dark:bg-amber-950/30"
          label="Waiting for approval"
          value={d.pendingApproval ?? d.pendingOrders}
          trend={trends?.pendingApproval}
        />
        <KpiCard
          icon="fa-hourglass-half"
          iconTone="bg-sky-500 text-white"
          cardTone="bg-sky-50 dark:bg-sky-950/30"
          label="Pending"
          value={countCommercialPending(d.ordersByStatus ?? [])}
        />
        <KpiCard
          icon="fa-truck"
          iconTone="bg-violet-500 text-white"
          cardTone="bg-violet-50 dark:bg-violet-950/30"
          label="Out for delivery"
          value={d.outForDelivery}
        />
        <KpiCard
          icon="fa-circle-check"
          iconTone="bg-teal-600 text-white"
          cardTone="bg-teal-50 dark:bg-teal-950/30"
          label="Delivered today"
          value={d.deliveredToday}
          trend={trends?.deliveredToday}
        />
        <KpiCard
          icon="fa-ban"
          iconTone="bg-slate-500 text-white"
          cardTone="bg-slate-50 dark:bg-slate-950/30"
          label="Cancelled"
          value={d.cancelled ?? 0}
        />
      </div>

      {/* Finance row */}
      <div className="grid gap-3 md:grid-cols-3">
        <FinanceCard
          icon="fa-sack-dollar"
          iconTone="bg-emerald-500 text-white"
          cardTone="bg-white dark:bg-surface-card"
          label="Today's revenue"
          value={fmtMoney(d.todaysRevenue)}
          trend={trends?.todaysRevenue}
          spark={trendDays.map((x) => x.revenue)}
          stroke="#16a34a"
        />
        <FinanceCard
          icon="fa-wallet"
          iconTone="bg-amber-500 text-white"
          cardTone="bg-white dark:bg-surface-card"
          label="COD pending"
          value={fmtMoney(d.codPendingAmount ?? d.codPending)}
          spark={trendDays.map((x) => x.codPending)}
          stroke="#f59e0b"
        />
        <FinanceCard
          icon="fa-hand-holding-dollar"
          iconTone="bg-sky-500 text-white"
          cardTone="bg-white dark:bg-surface-card"
          label="COD collected"
          value={fmtMoney(d.codCollectedAmount ?? d.codCollected)}
          spark={trendDays.map((x) => x.codCollected)}
          stroke="#3b82f6"
        />
      </div>

      {/* Charts row */}
      <div className="grid min-w-0 gap-4 xl:grid-cols-12">
        <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-white p-4 shadow-sm dark:bg-surface-card xl:col-span-6">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-text-strong">
              <i className="fa-solid fa-chart-line text-xs text-brand-600" aria-hidden />
              Orders trend
            </h2>
            <span className="rounded-md border border-border bg-surface-sunken px-2 py-0.5 text-xs text-text-muted">
              Last 7 days
            </span>
          </div>
          <div className="mb-2 flex flex-wrap gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 text-text-body">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Orders
            </span>
            <span className="inline-flex items-center gap-1.5 text-text-body">
              <span className="h-2 w-2 rounded-full bg-sky-500" /> Revenue
            </span>
          </div>
          <DualLineChart days={trendDays} />
        </div>

        <div className="min-w-0 xl:col-span-3">
          <DonutChart title="Orders by status" slices={statusSlices} />
        </div>
        <div className="min-w-0 xl:col-span-3">
          <DonutChart title="COD breakdown" slices={codSlices} emptyHint="No COD amounts yet." />
        </div>
      </div>

      {/* Recent orders + live activity */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-white shadow-sm dark:bg-surface-card">
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-text-strong">
              <i className="fa-solid fa-list text-xs text-brand-600" aria-hidden />
              Recent orders
            </h2>
            <Link to="/orders/oms" className="text-xs font-medium text-brand-700 hover:underline">
              View all
            </Link>
          </div>
          {(d.recentOrders ?? []).length === 0 ? (
            <p className="px-5 py-8 text-sm text-text-muted">No recent orders.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-text-muted dark:bg-surface-card-muted">
                  <tr>
                    <th className="px-4 py-2.5 text-start">Order</th>
                    <th className="px-4 py-2.5 text-start">Customer</th>
                    <th className="px-4 py-2.5 text-start">Status</th>
                    <th className="px-4 py-2.5 text-start">Payment</th>
                    <th className="px-4 py-2.5 text-end">COD</th>
                    <th className="px-4 py-2.5 text-end">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {(d.recentOrders ?? []).map((row, i) => (
                    <tr key={row.id} className="hover:bg-emerald-50/40 dark:hover:bg-surface-sunken/60">
                      <td className="px-4 py-2.5">
                        <Link
                          to={`/orders/oms/${row.id}`}
                          className="font-mono text-xs font-semibold text-brand-700 hover:underline"
                        >
                          {row.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${AVATAR_TONES[i % AVATAR_TONES.length]}`}
                          >
                            {customerInitials(row.recipientName ?? row.companyName)}
                          </span>
                          <span className="truncate text-text-strong">
                            {row.recipientName ?? row.companyName ?? '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <OmsStatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-2.5">
                        {row.paymentMethod ? (
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              row.paymentMethod === 'COD'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {row.paymentMethod === 'PREPAID' || row.paymentMethod === 'CREDIT'
                              ? 'Online'
                              : row.paymentMethod}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-end tabular-nums text-text-body">
                        {row.codAmount ? fmtMoney(row.codAmount, row.currency ?? 'SYP') : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-end text-xs text-text-muted">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-white p-4 shadow-sm dark:bg-surface-card">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-text-strong">
              <i className="fa-solid fa-bolt text-xs text-amber-500" aria-hidden />
              Live activity
            </h2>
            <Link to="/orders/oms" className="text-xs font-medium text-brand-700 hover:underline">
              View all
            </Link>
          </div>
          {(d.liveActivity ?? []).length === 0 ? (
            <p className="text-sm text-text-muted">No recent events.</p>
          ) : (
            <ul className="max-h-[420px] space-y-3 overflow-y-auto pe-1">
              {(d.liveActivity ?? []).slice(0, 12).map((ev) => {
                const tone = eventIcon(ev.eventType);
                return (
                  <li key={ev.id} className="flex gap-2.5 text-sm">
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tone.tone}`}
                    >
                      <i className={`fa-solid ${tone.icon} text-[10px]`} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      {ev.orderId ? (
                        <Link
                          to={`/orders/oms/${ev.orderId}`}
                          className="font-medium text-text-strong hover:text-brand-700 hover:underline"
                        >
                          {eventLabel(ev)}
                        </Link>
                      ) : (
                        <span className="font-medium text-text-strong">{eventLabel(ev)}</span>
                      )}
                      <div className="text-xs text-text-muted">{relativeTime(ev.createdAt)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </AdminListPageShell>
  );
}
