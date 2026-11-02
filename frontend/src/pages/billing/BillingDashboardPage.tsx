import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { BillingApi } from '../../api/billing';
import { AdminListPageShell } from '../../components/AdminListPageShell';
import { BillingExpiringClientsCard } from '../../components/dashboard/BillingExpiringClientsCard';
import { BillingOverdueClientsCard } from '../../components/dashboard/BillingOverdueClientsCard';
import { BillingRecentInvoicesCard } from '../../components/dashboard/BillingRecentInvoicesCard';
import { BillingSuspendedAccountsCard } from '../../components/dashboard/BillingSuspendedAccountsCard';
import { QK } from '../../constants/query-keys';
import { formatDecimal } from '../../lib/billing-invoice-display';
import { Alert, Card, Skeleton } from '@ds';

const CURRENCY = 'USD';

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card padding="md">
      <p className="text-[10px] font-bold uppercase tracking-widest text-text-faint">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-text-strong">{value}</p>
    </Card>
  );
}

function BucketList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ companyId: string; companyName: string; daysRemaining: number }>;
}) {
  return (
    <Card padding="md">
      <h3 className="mb-3 text-sm font-semibold text-text-strong">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">None</p>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {rows.map((row) => (
            <li key={row.companyId} className="flex items-center justify-between py-2 text-sm">
              <Link
                to={`/billing/plans/${row.companyId}`}
                className="font-medium text-brand-700 hover:underline dark:text-brand-400"
              >
                {row.companyName}
              </Link>
              <span className="tabular-nums text-text-muted">{row.daysRemaining}d</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function BillingDashboardPage() {
  const summaryQuery = useQuery({
    queryKey: QK.billing.dashboardSummary,
    queryFn: () => BillingApi.getDashboardSummary(),
  });

  const bucketsQuery = useQuery({
    queryKey: QK.billing.expiringBuckets,
    queryFn: () => BillingApi.getExpiringBuckets(),
  });

  const summary = summaryQuery.data;
  const buckets = bucketsQuery.data;

  return (
    <AdminListPageShell
      icon="fa-chart-pie"
      title="Billing dashboard"
      subtitle="Subscription revenue, plan activity, and upcoming renewals."
      showSectionNav
      className="space-y-6 animate-enter"
    >
      {summaryQuery.isPending ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            label="Outstanding AR"
            value={`${formatDecimal(summary.outstandingAmount)} ${CURRENCY}`}
          />
          <KpiCard
            label="Month revenue"
            value={`${formatDecimal(summary.currentMonthRevenue)} ${CURRENCY}`}
          />
          <KpiCard label="Open invoices" value={String(summary.openInvoiceCount)} />
          <KpiCard label="Overdue invoices" value={String(summary.overdueInvoiceCount)} />
          <KpiCard label="Suspended accounts" value={String(summary.suspendedAccountCount)} />
        </div>
      ) : null}

      {buckets ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <BucketList title="Expiring in 30 days" rows={buckets.expiring30} />
          <BucketList title="Expiring in 14 days" rows={buckets.expiring14} />
          <BucketList title="Expiring in 7 days" rows={buckets.expiring7} />
          <BucketList title="Expiring in 3 days" rows={buckets.expiring3} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BillingExpiringClientsCard />
        <BillingOverdueClientsCard />
        <BillingRecentInvoicesCard />
        <BillingSuspendedAccountsCard />
      </div>
    </AdminListPageShell>
  );
}
