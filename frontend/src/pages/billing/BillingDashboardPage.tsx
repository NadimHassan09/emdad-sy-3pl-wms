import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { BillingApi } from '../../api/billing';
import { AdminListPageShell } from '../../components/AdminListPageShell';
import { PieChart, type PieSlice } from '../../components/PieChart';
import { QK } from '../../constants/query-keys';
import { formatDate, formatDecimal } from '../../lib/billing-invoice-display';
import { Alert, Card, Skeleton } from '@ds';

const CURRENCY = 'SYP';

const CHART_COLORS = [
  'var(--color-brand-600)',
  'var(--color-info-500)',
  'var(--color-warning-600)',
  'var(--color-danger-600)',
  'var(--text-muted)',
  'var(--color-brand-500)',
  'var(--color-info-700)',
];

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card padding="md">
      <p className="text-[10px] font-bold uppercase tracking-widest text-text-faint">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-text-strong">{value}</p>
    </Card>
  );
}

function ListCard({
  title,
  children,
  empty,
}: {
  title: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <Card padding="md">
      <h3 className="mb-3 text-sm font-semibold text-text-strong">{title}</h3>
      {empty ? <p className="text-sm text-text-muted">No data yet.</p> : children}
    </Card>
  );
}

function SimpleBarList({
  rows,
}: {
  rows: Array<{ label: string; value: number; display: string }>;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-text-body">{row.label}</span>
            <span className="shrink-0 tabular-nums text-text-strong">{row.display}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(4, (row.value / max) * 100)}%`,
                backgroundColor: 'var(--color-brand-500)',
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function BillingDashboardPage() {
  const summaryQuery = useQuery({
    queryKey: QK.billing.dashboardSummary,
    queryFn: () => BillingApi.getDashboardSummary(),
  });

  const analyticsQuery = useQuery({
    queryKey: QK.billing.dashboardAnalytics,
    queryFn: () => BillingApi.getDashboardAnalytics(),
  });

  const summary = summaryQuery.data;
  const analytics = analyticsQuery.data;

  const monthlyRows = useMemo(() => {
    const src = analytics?.monthlyRevenue ?? analytics?.revenueTrend ?? [];
    return src.map((r) => ({
      label: r.month,
      value: Number(r.revenue) || 0,
      display: `${formatDecimal(r.revenue)} ${CURRENCY}`,
    }));
  }, [analytics]);

  const clientRows = useMemo(
    () =>
      (analytics?.revenueByClient ?? []).map((r) => ({
        label: r.companyName,
        value: Number(r.revenue) || 0,
        display: `${formatDecimal(r.revenue)} ${CURRENCY}`,
      })),
    [analytics],
  );

  const templateSlices: PieSlice[] = useMemo(
    () =>
      (analytics?.plansByTemplate ?? []).map((r, i) => ({
        label: r.label,
        count: r.count,
        color: CHART_COLORS[i % CHART_COLORS.length]!,
      })),
    [analytics],
  );

  return (
    <AdminListPageShell
      icon="fa-chart-pie"
      title="Billing dashboard"
      subtitle="Subscription revenue, plan activity, and upcoming renewals."
      showSectionNav
      className="space-y-6 animate-enter"
    >
      {summaryQuery.isPending ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} padding="md">
              <Skeleton height={14} width="70%" />
              <Skeleton height={32} width="50%" className="mt-3" />
            </Card>
          ))}
        </div>
      ) : null}
      {summaryQuery.isError ? (
        <Alert variant="error" title="Could not load dashboard summary" />
      ) : null}

      {summary ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Total monthly revenue"
            value={`${formatDecimal(summary.currentMonthRevenue)} ${CURRENCY}`}
          />
          <KpiCard
            label="Total annual revenue"
            value={`${formatDecimal(summary.annualRevenue ?? '0')} ${CURRENCY}`}
          />
          <KpiCard
            label="Outstanding revenue"
            value={`${formatDecimal(summary.outstandingAmount)} ${CURRENCY}`}
          />
          <KpiCard
            label="Active billing plans"
            value={String(summary.activeBillingPlanCount ?? 0)}
          />
          <KpiCard
            label="Generated invoices"
            value={String(summary.generatedInvoiceCount ?? 0)}
          />
          <KpiCard label="Paid invoices" value={String(summary.paidInvoiceCount ?? 0)} />
          <KpiCard
            label="Outstanding invoices"
            value={String(summary.outstandingInvoiceCount ?? summary.openInvoiceCount ?? 0)}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ListCard title="Monthly revenue" empty={monthlyRows.length === 0}>
          <SimpleBarList rows={monthlyRows} />
        </ListCard>

        <ListCard title="Revenue trend" empty={monthlyRows.length === 0}>
          <SimpleBarList rows={[...monthlyRows].reverse()} />
        </ListCard>

        <PieChart title="Plans by template" slices={templateSlices} />

        <ListCard title="Revenue by client" empty={clientRows.length === 0}>
          <SimpleBarList rows={clientRows} />
        </ListCard>

        <div className="lg:col-span-2">
          <ListCard
            title="Upcoming renewals"
            empty={!analytics?.upcomingRenewals?.length}
          >
            <ul className="divide-y divide-border-subtle">
              {(analytics?.upcomingRenewals ?? []).map((row) => (
                <li
                  key={row.cycleId}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                >
                  <div>
                    <Link
                      to={`/billing/plans/${row.companyId}`}
                      className="font-medium text-brand-700 hover:underline dark:text-brand-400"
                    >
                      {row.companyName}
                    </Link>
                    <p className="text-xs text-text-muted">
                      Renews {formatDate(row.renewalDate)} · {row.daysRemaining}d left ·{' '}
                      {row.cycleLengthDays}d cycle
                    </p>
                  </div>
                  <span className="tabular-nums font-medium text-text-strong">
                    {formatDecimal(row.amount)} {CURRENCY}
                  </span>
                </li>
              ))}
            </ul>
          </ListCard>
        </div>
      </div>
    </AdminListPageShell>
  );
}
