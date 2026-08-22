import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Alert, Card, Skeleton } from '@ds';

import { CompaniesApi } from '../api/companies';
import type { OmsDashboardSummary } from '../api/oms';
import { OmsApi } from '../api/oms';
import { AdminListPageShell } from '../components/AdminListPageShell';
import { OmsStatusBadge } from '../components/oms/OmsStatusBadge';
import { QK } from '../constants/query-keys';
import {
  aggregateCommercialStatusCounts,
  OMS_COMMERCIAL_STATUS_COLORS,
  omsCommercialStatusLabel,
} from '../lib/oms-commercial-status';

type DateRangePreset = 'this_month' | 'last_7_days' | 'last_month' | 'custom';

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function datesForPreset(preset: Exclude<DateRangePreset, 'custom'>): {
  from: string;
  to: string;
} {
  const now = new Date();
  if (preset === 'last_7_days') {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    return { from: toYmd(from), to: toYmd(now) };
  }
  if (preset === 'last_month') {
    const base = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { from: toYmd(startOfMonth(base)), to: toYmd(endOfMonth(base)) };
  }
  return { from: toYmd(startOfMonth(now)), to: toYmd(endOfMonth(now)) };
}

function fmtMoney(value: string | number | null | undefined, currency = 'USD'): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.length === 3 ? currency : 'USD',
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

/** Mirror client dashboard commercial buckets from raw status counts. */
const WAITING = new Set([
  'draft',
  'waiting_for_confirmation',
  'confirmed_waiting_for_admin_approval',
  'pending_approval',
]);
const PENDING_FULFILLMENT = new Set([
  'pending',
  'approved',
  'confirmed',
  'processing',
  'allocated',
  'picking',
  'packing',
  'ready_to_ship',
  'failed_delivery',
]);
const OUT_FOR_DELIVERY = new Set(['shipped', 'out_for_delivery']);
const DELIVERED = new Set(['delivered', 'completed']);
const RETURNED = new Set(['returned']);
const CANCELLED_OR_FAILED = new Set(['cancelled', 'rejected']);

function sumBucket(
  rows: Array<{ status: string; count: number }> | undefined,
  bucket: Set<string>,
): number {
  let n = 0;
  for (const row of rows ?? []) {
    if (bucket.has(row.status)) n += row.count;
  }
  return n;
}

function pct(count: number, total: number): string {
  if (total <= 0) return '0%';
  return `${((count / total) * 100).toFixed(1)}%`;
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
              const share = Math.round((sl.count / total) * 100);
              return (
                <li key={sl.label} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: sl.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-text-body">{sl.label}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-text-strong">
                    {share}%
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

type KpiTone = 'emerald' | 'amber' | 'sky' | 'violet' | 'teal' | 'slate' | 'rose';

function TopKpi({
  label,
  value,
  hint,
  icon,
  tone,
  to,
}: {
  label: string;
  value: ReactNode;
  hint: string;
  icon: string;
  tone: KpiTone;
  to?: string;
}): ReactElement {
  const tones: Record<
    KpiTone,
    { card: string; bg: string; text: string; value: string }
  > = {
    emerald: {
      card: 'border-emerald-200',
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      value: 'text-emerald-700',
    },
    amber: {
      card: 'border-amber-200',
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      value: 'text-amber-700',
    },
    sky: {
      card: 'border-sky-200',
      bg: 'bg-sky-50',
      text: 'text-sky-600',
      value: 'text-sky-700',
    },
    violet: {
      card: 'border-violet-200',
      bg: 'bg-violet-50',
      text: 'text-violet-600',
      value: 'text-violet-700',
    },
    teal: {
      card: 'border-teal-200',
      bg: 'bg-teal-50',
      text: 'text-teal-600',
      value: 'text-teal-700',
    },
    slate: {
      card: 'border-border',
      bg: 'bg-surface-sunken',
      text: 'text-text-muted',
      value: 'text-text-strong',
    },
    rose: {
      card: 'border-rose-200',
      bg: 'bg-rose-50',
      text: 'text-rose-600',
      value: 'text-rose-700',
    },
  };
  const t = tones[tone];
  const body = (
    <Card className={`h-full border p-5 ${t.card}`} interactive>
      <div className="flex items-center gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${t.bg}`}
        >
          <i className={`fa-solid ${icon} text-lg ${t.text}`} aria-hidden />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-text-muted">{label}</div>
          <div className={`mt-1 text-3xl font-bold tabular-nums ${t.value}`}>{value}</div>
          <div className="mt-1 text-[11px] text-text-faint">{hint}</div>
        </div>
      </div>
    </Card>
  );
  if (to) {
    return (
      <Link to={to} className="block h-full no-underline">
        {body}
      </Link>
    );
  }
  return body;
}

function StatusCell({
  label,
  count,
  total,
  colorClass,
}: {
  label: string;
  count: number;
  total: number;
  colorClass: string;
}): ReactElement {
  return (
    <div className="min-w-0 px-1.5 py-3 text-center sm:px-2">
      <div className={`text-xl font-bold tabular-nums sm:text-2xl ${colorClass}`}>
        {count.toLocaleString()}
      </div>
      <div className="mt-1 text-[10px] font-semibold leading-snug text-text-muted sm:text-[11px]">
        {label}
      </div>
      <div className="mt-0.5 text-[10px] text-text-faint">{pct(count, total)}</div>
    </div>
  );
}

function OrdersTrendChart({
  days,
}: {
  days: Array<{ day: string; count: number; revenue: number }>;
}): ReactElement {
  if (days.length === 0) {
    return <p className="py-10 text-center text-sm text-text-muted">No trend data yet.</p>;
  }

  const data = days.map((d) => ({
    ...d,
    label: d.day.slice(5),
  }));

  return (
    <div className="h-56 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle, #e2e8f0)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
          />
          <YAxis
            yAxisId="orders"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={36}
          />
          <YAxis
            yAxisId="revenue"
            orientation="right"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            cursor={{ stroke: '#94a3b8', strokeDasharray: '4 4' }}
            contentStyle={{
              borderRadius: 10,
              border: '1px solid var(--border-default, #e2e8f0)',
              background: 'var(--surface-panel, #fff)',
              color: 'var(--text-strong, #0f172a)',
              fontSize: 12,
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
            }}
            formatter={(value, name) => {
              const n = typeof value === 'number' ? value : Number(value);
              const label = name === 'count' ? 'Orders' : 'Revenue';
              if (name === 'revenue') {
                return [fmtMoney(n), label];
              }
              return [Number.isFinite(n) ? n.toLocaleString() : '—', label];
            }}
            labelFormatter={(label, payload) => {
              const day = payload?.[0]?.payload?.day;
              return day ? `Day ${day}` : String(label);
            }}
          />
          <Legend
            formatter={(value) => (value === 'count' ? 'Orders' : 'Revenue')}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Line
            yAxisId="orders"
            type="monotone"
            dataKey="count"
            name="count"
            stroke="#16a34a"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#16a34a', strokeWidth: 0 }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
          />
          <Line
            yAxisId="revenue"
            type="monotone"
            dataKey="revenue"
            name="revenue"
            stroke="#3b82f6"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
          />
        </LineChart>
      </ResponsiveContainer>
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
  const initialRange = datesForPreset('this_month');
  const [rangePreset, setRangePreset] = useState<DateRangePreset>('this_month');
  const [createdFrom, setCreatedFrom] = useState(initialRange.from);
  const [createdTo, setCreatedTo] = useState(initialRange.to);
  const [summaryCompanyId, setSummaryCompanyId] = useState('');

  const applyPreset = (preset: Exclude<DateRangePreset, 'custom'>) => {
    setRangePreset(preset);
    const { from, to } = datesForPreset(preset);
    setCreatedFrom(from);
    setCreatedTo(to);
  };

  const summaryFilters = useMemo(
    () => ({
      createdFrom: createdFrom || undefined,
      createdTo: createdTo || undefined,
      companyId: summaryCompanyId.trim() || undefined,
    }),
    [createdFrom, createdTo, summaryCompanyId],
  );

  const dash = useQuery({
    queryKey: QK.omsDashboard,
    queryFn: () => OmsApi.dashboard(),
  });

  const companiesQuery = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
  });

  const orderSummaryQuery = useQuery({
    queryKey: QK.omsOrderSummary(summaryFilters),
    queryFn: () => OmsApi.orderSummary(summaryFilters),
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
        onClick={() => {
          void dash.refetch();
          void orderSummaryQuery.refetch();
        }}
        className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-border bg-white text-text-muted hover:bg-surface-sunken hover:text-text-strong dark:bg-surface-card"
        title="Refresh"
        aria-label="Refresh dashboard"
      >
        <i
          className={`fa-solid fa-rotate ${dash.isFetching || orderSummaryQuery.isFetching ? 'fa-spin' : ''}`}
          aria-hidden
        />
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

  const orderSummary = useMemo(() => {
    const rows = orderSummaryQuery.data?.ordersByStatus ?? [];
    const waiting = sumBucket(rows, WAITING);
    const pending = sumBucket(rows, PENDING_FULFILLMENT);
    const out = sumBucket(rows, OUT_FOR_DELIVERY);
    const delivered = sumBucket(rows, DELIVERED);
    const returned = sumBucket(rows, RETURNED);
    const cancelled = sumBucket(rows, CANCELLED_OR_FAILED);
    const total =
      orderSummaryQuery.data?.total ??
      waiting + pending + out + delivered + returned + cancelled;
    return { total, waiting, pending, out, delivered, returned, cancelled };
  }, [orderSummaryQuery.data]);

  if (dash.isLoading) {
    return (
      <AdminListPageShell
        icon="fa-gauge-high"
        title="OMS Dashboard"
        subtitle="E-commerce order pipeline and COD snapshot."
        actions={headerActions}
        showSectionNav
      >
        <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Card key={i} padding="md" className="h-full">
              <Skeleton height={88} />
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

  const todayTrend = fmtPct(trends?.ordersToday);
  const pendingTrend = fmtPct(trends?.pendingApproval);
  const deliveredTrend = fmtPct(trends?.deliveredToday);
  const revenueTrend = fmtPct(trends?.todaysRevenue);

  return (
    <AdminListPageShell
      icon="fa-gauge-high"
      title="OMS Dashboard"
      subtitle="E-commerce order pipeline and COD snapshot."
      actions={headerActions}
      showSectionNav
    >
      {/* KPI row — equal-size cards in one grid */}
      <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <TopKpi
          label="Today's orders"
          value={d.ordersToday.toLocaleString()}
          hint={todayTrend.text}
          icon="fa-cart-shopping"
          tone="emerald"
          to="/orders/oms"
        />
        <TopKpi
          label="Waiting for approval"
          value={(d.pendingApproval ?? d.pendingOrders).toLocaleString()}
          hint={pendingTrend.text}
          icon="fa-clock"
          tone="amber"
          to="/orders/oms"
        />
        <TopKpi
          label="Out for delivery"
          value={d.outForDelivery.toLocaleString()}
          hint="In transit to customers"
          icon="fa-truck"
          tone="violet"
          to="/orders/oms"
        />
        <TopKpi
          label="Delivered today"
          value={d.deliveredToday.toLocaleString()}
          hint={deliveredTrend.text}
          icon="fa-circle-check"
          tone="teal"
          to="/orders/oms"
        />
        <TopKpi
          label="Today's revenue"
          value={fmtMoney(d.todaysRevenue)}
          hint={revenueTrend.text}
          icon="fa-sack-dollar"
          tone="emerald"
        />
        <TopKpi
          label="COD pending"
          value={fmtMoney(d.codPendingAmount ?? d.codPending)}
          hint="Awaiting collection"
          icon="fa-wallet"
          tone="amber"
          to="/oms/cod"
        />
        <TopKpi
          label="COD collected"
          value={fmtMoney(d.codCollectedAmount ?? d.codCollected)}
          hint="Ready for remittance"
          icon="fa-hand-holding-dollar"
          tone="sky"
          to="/oms/cod"
        />
      </div>

      {/* Order movement + Order summary */}
      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-4">
          <DonutChart title="Orders by status" slices={statusSlices} />
        </div>

        <Card className="min-w-0 border border-border p-5 xl:col-span-8">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-base font-bold text-text-strong">Order summary</h2>
              <p className="mt-0.5 text-xs text-text-muted">Where are my orders?</p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-[8.5rem] flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  Range
                </span>
                <select
                  value={rangePreset === 'custom' ? 'custom' : rangePreset}
                  onChange={(e) => {
                    const v = e.target.value as DateRangePreset;
                    if (v === 'custom') {
                      setRangePreset('custom');
                      return;
                    }
                    applyPreset(v);
                  }}
                  className="h-9 rounded-lg border border-border bg-white px-3 text-sm text-text-body dark:bg-surface-card"
                  aria-label="Date range preset"
                >
                  <option value="this_month">This month</option>
                  <option value="last_7_days">Last 7 days</option>
                  <option value="last_month">Last month</option>
                  {rangePreset === 'custom' ? (
                    <option value="custom">Custom</option>
                  ) : null}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  Created from
                </span>
                <input
                  type="date"
                  value={createdFrom}
                  onChange={(e) => {
                    setRangePreset('custom');
                    setCreatedFrom(e.target.value);
                  }}
                  className="h-9 rounded-lg border border-border bg-white px-2 text-sm text-text-body dark:bg-surface-card"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  Created to
                </span>
                <input
                  type="date"
                  value={createdTo}
                  onChange={(e) => {
                    setRangePreset('custom');
                    setCreatedTo(e.target.value);
                  }}
                  className="h-9 rounded-lg border border-border bg-white px-2 text-sm text-text-body dark:bg-surface-card"
                />
              </label>
              <label className="flex min-w-[10rem] flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  Client
                </span>
                <select
                  value={summaryCompanyId}
                  onChange={(e) => setSummaryCompanyId(e.target.value)}
                  className="h-9 rounded-lg border border-border bg-white px-3 text-sm text-text-body dark:bg-surface-card"
                  aria-label="Client company"
                >
                  <option value="">All clients</option>
                  {(companiesQuery.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.tradeName?.trim() || c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          {orderSummaryQuery.isError ? (
            <Alert
              variant="error"
              title="Could not load order summary"
              description="Check filters and try again."
            />
          ) : orderSummaryQuery.isLoading ? (
            <Skeleton height={96} />
          ) : (
            <div className="grid grid-cols-2 divide-y divide-border-subtle rounded-xl border border-border-subtle bg-surface-card-muted sm:grid-cols-4 sm:divide-x sm:divide-y-0 lg:grid-cols-7">
              <StatusCell
                label="Total orders"
                count={orderSummary.total}
                total={orderSummary.total || 1}
                colorClass="text-text-strong"
              />
              <StatusCell
                label="Waiting"
                count={orderSummary.waiting}
                total={orderSummary.total || 1}
                colorClass="text-amber-600 dark:text-amber-400"
              />
              <StatusCell
                label="Pending"
                count={orderSummary.pending}
                total={orderSummary.total || 1}
                colorClass="text-blue-600 dark:text-blue-400"
              />
              <StatusCell
                label="Out for delivery"
                count={orderSummary.out}
                total={orderSummary.total || 1}
                colorClass="text-violet-600 dark:text-violet-400"
              />
              <StatusCell
                label="Delivered"
                count={orderSummary.delivered}
                total={orderSummary.total || 1}
                colorClass="text-brand-600 dark:text-brand-400"
              />
              <StatusCell
                label="Returned"
                count={orderSummary.returned}
                total={orderSummary.total || 1}
                colorClass="text-rose-600 dark:text-rose-400"
              />
              <StatusCell
                label="Cancelled / failed"
                count={orderSummary.cancelled}
                total={orderSummary.total || 1}
                colorClass="text-text-muted"
              />
            </div>
          )}
        </Card>
      </div>

      {/* Orders trend — interactive Recharts tooltips */}
      <Card className="min-w-0 overflow-hidden border border-border p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-text-strong">
            <i className="fa-solid fa-chart-line text-xs text-brand-600" aria-hidden />
            Orders trend
          </h2>
          <span className="rounded-md border border-border bg-surface-sunken px-2 py-0.5 text-xs text-text-muted">
            Last 7 days · hover a point for values
          </span>
        </div>
        <OrdersTrendChart days={trendDays} />
      </Card>

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
                    <tr
                      key={row.id}
                      className="hover:bg-emerald-50/40 dark:hover:bg-surface-sunken/60"
                    >
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
                        {row.codAmount ? fmtMoney(row.codAmount, row.currency ?? 'USD') : '—'}
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
