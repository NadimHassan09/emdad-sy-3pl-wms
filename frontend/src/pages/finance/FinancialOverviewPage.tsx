import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Alert, Badge, Button, Card, Skeleton } from '@ds';

import { AdminListPageShell } from '../../components/AdminListPageShell';
import { FinanceNav } from '../../components/finance/FinanceNav';
import { FinanceApi } from '../../api/finance';

function KpiCard({
  title,
  value,
  sub,
  tone = 'default',
}: {
  title: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'success' | 'warning' | 'brand';
}) {
  const toneClasses = {
    default: 'text-text-strong',
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    brand: 'text-brand-600 dark:text-brand-400',
  };

  return (
    <Card padding="md" className="flex flex-col justify-between">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{title}</p>
        <p className={`mt-2 text-2xl font-bold tabular-nums ${toneClasses[tone]}`}>{value}</p>
      </div>
      {sub ? <p className="mt-2 text-xs text-text-muted">{sub}</p> : null}
    </Card>
  );
}

export function FinancialOverviewPage() {
  const { data: overview, isLoading, error, refetch } = useQuery({
    queryKey: ['finance', 'overview'],
    queryFn: () => FinanceApi.getOverview(),
  });

  const { data: accountsData } = useQuery({
    queryKey: ['finance', 'accounts', { limit: 5 }],
    queryFn: () => FinanceApi.listAccounts({ limit: 5 }),
  });

  const { data: payoutsData } = useQuery({
    queryKey: ['finance', 'payouts', { limit: 5 }],
    queryFn: () => FinanceApi.listPayouts({ limit: 5 }),
  });

  return (
    <AdminListPageShell
      icon="Reports"
      title="Financial Management"
      subtitle="Current-account ledger, client balances, COD clearing, settlements, and carrier costs"
      showSectionNav={false}
    >
      <FinanceNav
        actions={
          <Button variant="secondary" onClick={() => refetch()}>
            Refresh
          </Button>
        }
      />

      {error ? (
        <Alert variant="error" className="mb-4">
          Failed to load financial overview.
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : overview ? (
        <div className="space-y-6">
          {/* Main KPI Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Total Client Balances"
              value={`$${Number(overview.totalClientBalances).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              sub="Net payable balance across all client accounts"
              tone="brand"
            />
            <KpiCard
              title="Total Available Balances"
              value={`$${Number(overview.totalAvailableBalances).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              sub="Ready for client withdrawal or payout request"
              tone="success"
            />
            <KpiCard
              title="Total Pending COD"
              value={`$${Number(overview.totalPendingCod).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              sub="Held until carrier collection / remittance confirmation"
              tone="warning"
            />
            <KpiCard
              title="Reserved in Payouts"
              value={`$${Number(overview.totalPayoutLocked).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              sub={`${overview.payoutsPendingCount} pending payout request(s)`}
              tone="default"
            />
          </div>

          {/* Secondary stats row */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card padding="md">
              <p className="text-xs font-semibold text-text-muted">Total Recorded Shipping Charges</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-text-strong">
                ${Number(overview.totalShippingCharges).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-xs text-text-muted">{overview.shippingChargesCount} order charges recorded</p>
            </Card>

            <Card padding="md">
              <p className="text-xs font-semibold text-text-muted">Completed Payout Disbursements</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                ${Number(overview.totalPayoutsCompleted).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-xs text-text-muted">{overview.payoutsCompletedCount} paid disbursements</p>
            </Card>

            <Card padding="md">
              <p className="text-xs font-semibold text-text-muted">Active Primary Model</p>
              <div className="mt-2 flex items-center gap-2">
                <Badge tone="success">Current Account Active</Badge>
              </div>
              <p className="mt-2 text-xs text-text-muted">Legacy cycle invoicing disabled on staging cutover</p>
            </Card>
          </div>

          {/* Recent Accounts & Pending Payouts Preview */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card padding="md">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-text-strong">Recent Client Accounts</h3>
                <Link to="/finance/accounts" className="text-xs font-medium text-brand-600 hover:underline">
                  View all accounts →
                </Link>
              </div>
              <div className="divide-y divide-border-subtle">
                {(accountsData?.items ?? []).map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium text-text-strong">{acc.company?.name ?? acc.companyId}</p>
                      <p className="text-xs text-text-muted">
                        Pending COD: ${Number(acc.pendingBalance).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold tabular-nums text-text-strong">
                        ${Number(acc.currentBalance).toFixed(2)}
                      </p>
                      <p className="text-xs font-medium text-emerald-600">
                        Avail: ${Number(acc.availableBalance).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card padding="md">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-text-strong">Recent Payout Requests</h3>
                <Link to="/finance/payouts" className="text-xs font-medium text-brand-600 hover:underline">
                  Manage payouts →
                </Link>
              </div>
              <div className="divide-y divide-border-subtle">
                {(payoutsData?.items ?? []).length === 0 ? (
                  <p className="py-4 text-center text-xs text-text-muted">No payout requests recorded.</p>
                ) : (
                  (payoutsData?.items ?? []).map((pay) => (
                    <div key={pay.id} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <p className="font-medium text-text-strong">{pay.payoutNumber}</p>
                        <p className="text-xs text-text-muted">{pay.company?.name ?? pay.companyId}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold tabular-nums text-text-strong">${Number(pay.amount).toFixed(2)}</span>
                        <Badge
                          tone={
                            pay.status === 'paid'
                              ? 'success'
                              : pay.status === 'approved'
                                ? 'brand'
                                : pay.status === 'rejected'
                                  ? 'danger'
                                  : 'warning'
                          }
                        >
                          {pay.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </AdminListPageShell>
  );
}

export default FinancialOverviewPage;
