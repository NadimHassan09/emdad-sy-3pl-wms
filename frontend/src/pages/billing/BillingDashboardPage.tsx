import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { BillingApi } from '../../api/billing';
import { BillingExpiringClientsCard } from '../../components/dashboard/BillingExpiringClientsCard';
import { BillingOverdueClientsCard } from '../../components/dashboard/BillingOverdueClientsCard';
import { BillingRecentInvoicesCard } from '../../components/dashboard/BillingRecentInvoicesCard';
import { BillingSuspendedAccountsCard } from '../../components/dashboard/BillingSuspendedAccountsCard';
import { PageHeader } from '../../components/PageHeader';
import { QK } from '../../constants/query-keys';
import { formatDecimal } from '../../lib/billing-invoice-display';

function BucketList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ companyId: string; companyName: string; daysRemaining: number }>;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">None</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.companyId} className="flex items-center justify-between py-2 text-sm">
              <Link to={`/billing/plans/${row.companyId}`} className="font-medium text-brand-700 hover:underline">
                {row.companyName}
              </Link>
              <span className="tabular-nums text-slate-500">{row.daysRemaining}d</span>
            </li>
          ))}
        </ul>
      )}
    </div>
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
    <div className="space-y-6">
      <PageHeader
        title="Billing dashboard"
        description="Revenue, expirations, outstanding invoices, and suspended accounts."
      />

      {summary ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Outstanding AR</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{formatDecimal(summary.outstandingAmount)}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Month revenue</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{formatDecimal(summary.currentMonthRevenue)}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Open invoices</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{summary.openInvoiceCount}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Overdue invoices</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{summary.overdueInvoiceCount}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Suspended</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{summary.suspendedAccountCount}</p>
          </div>
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
    </div>
  );
}
