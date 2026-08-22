import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Alert, Card, ListPageHeader, Skeleton } from '@ds';
import { BillingApi } from '../../api/billing';
import { VolumeAllocationPanel } from '../../components/billing/VolumeAllocationPanel';
import { Button } from '../../components/Button';
import { DataTable, type Column } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { useAuth } from '../../auth/AuthContext';
import {
  humanizeInvoiceStatus,
  invoiceStatusClass,
} from '../../lib/billing-invoice-display';
import {
  daysRemainingFromEnd,
  formatDate,
  formatDecimal,
} from '../../lib/billing-plan-overview';

const CURRENCY = 'USD';

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-text-strong">{value}</dd>
    </div>
  );
}

function pendingSummary(pending: Record<string, unknown> | null | undefined): string[] {
  if (!pending || typeof pending !== 'object') return [];
  const lines: string[] = [];
  if (pending.reservedVolume != null) {
    lines.push(`Reserved volume → ${formatDecimal(String(pending.reservedVolume), 2)} m³`);
  }
  if (pending.fixedSubscriptionFee != null) {
    lines.push(`Price → ${formatDecimal(String(pending.fixedSubscriptionFee))} ${CURRENCY}`);
  }
  if (pending.cycleLengthDays != null) {
    lines.push(`Billing cycle → ${pending.cycleLengthDays} days`);
  }
  if (pending.planType != null) {
    lines.push(`Plan type → ${String(pending.planType)}`);
  }
  return lines;
}

export function BillingPlanDetailPage() {
  const { clientId = '' } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const canMutate = user?.role === 'super_admin' || user?.role === 'wh_manager';

  const detailQuery = useQuery({
    queryKey: QK.billing.planDetail(clientId),
    queryFn: () => BillingApi.getPlanDetailByClient(clientId),
    enabled: !!clientId,
  });

  const capacityQuery = useQuery({
    queryKey: QK.billing.capacity,
    queryFn: () => BillingApi.getCapacitySummary(),
    enabled: canMutate,
  });

  const storageQuery = useQuery({
    queryKey: [...QK.billing.capacity, 'company', clientId],
    queryFn: () => BillingApi.getCompanyStorage(clientId),
    enabled: canMutate && !!clientId,
  });

  const company = detailQuery.data?.company;
  const plan = detailQuery.data?.plan ?? null;
  const currentCycle = detailQuery.data?.currentCycle ?? null;
  const cycles = detailQuery.data?.cycles ?? [];
  const invoices = detailQuery.data?.invoices ?? [];
  const daysLeft = currentCycle ? daysRemainingFromEnd(currentCycle.endsAt) : null;
  const pendingLines = pendingSummary(plan?.pendingChanges as Record<string, unknown> | null);
  const isRestricted = company?.status === 'restricted';
  const canRenew =
    !!plan &&
    (isRestricted ||
      currentCycle?.status === 'active' ||
      !currentCycle ||
      currentCycle.status === 'expired');

  const renewMut = useMutation({
    mutationFn: () => BillingApi.renewPlan(plan!.id),
    onSuccess: (result) => {
      toast.success(
        result.mode === 'reactivated'
          ? 'Billing plan renewed. Access restored and a new cycle started.'
          : 'Billing cycle marked for renewal when it expires.',
      );
      void qc.invalidateQueries({ queryKey: QK.billing.planDetail(clientId) });
      void qc.invalidateQueries({ queryKey: QK.billing.plans });
      void qc.invalidateQueries({ queryKey: QK.billing.cycles });
      void qc.invalidateQueries({ queryKey: QK.billing.suspendedAccounts });
      void qc.invalidateQueries({ queryKey: QK.billing.overdueClients });
      void qc.invalidateQueries({ queryKey: QK.companies });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cycleColumns: Column<(typeof cycles)[number]>[] = [
    { header: 'Start', accessor: (r) => formatDate(r.startsAt) },
    { header: 'End', accessor: (r) => formatDate(r.endsAt) },
    { header: 'Status', accessor: (r) => <StatusBadge status={r.status} /> },
  ];

  const invoiceColumns: Column<(typeof invoices)[number]>[] = [
    {
      header: 'Invoice #',
      accessor: (r) => (
        <span className="font-mono text-sm font-semibold text-brand-700">{r.invoiceNumber}</span>
      ),
    },
    {
      header: 'Amount',
      accessor: (r) => `${formatDecimal(r.grandTotal ?? r.totalAmount)} ${CURRENCY}`,
    },
    {
      header: 'Issued',
      accessor: (r) => formatDate(r.issuedAt ?? r.createdAt),
    },
    {
      header: 'Status',
      accessor: (r) => (
        <span className={`w-fit ${invoiceStatusClass(r.status)}`}>
          {humanizeInvoiceStatus(r.status)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-enter">
      <Link
        to="/billing/plans"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text-strong"
      >
        <i className="fa-solid fa-arrow-left rtl:rotate-180 text-xs" aria-hidden="true" />
        Back to billing plans
      </Link>

      <ListPageHeader
        icon="fa-file-invoice-dollar"
        title={company ? `${company.name} — billing plan` : 'Client billing plan'}
        subtitle="Subscription storage plan, current cycle, history, and invoices."
        actions={
          canMutate ? (
            <div className="flex flex-wrap gap-2">
              {!plan ? (
                <Button variant="brand" onClick={() => navigate('/billing/plans/new')}>
                  Create plan
                </Button>
              ) : (
                <>
                  {canRenew ? (
                    <Button
                      variant="brand"
                      disabled={renewMut.isPending}
                      onClick={() => {
                        if (
                          !window.confirm(
                            isRestricted || !currentCycle || currentCycle.status === 'expired'
                              ? 'Renew this billing plan? This restores access and starts a new billing cycle.'
                              : 'Mark this billing cycle for renewal when it expires?',
                          )
                        ) {
                          return;
                        }
                        renewMut.mutate();
                      }}
                    >
                      Renew
                    </Button>
                  ) : null}
                  <Button variant="secondary" onClick={() => navigate(`/billing/plans/${clientId}/edit`)}>
                    Edit plan
                  </Button>
                </>
              )}
            </div>
          ) : undefined
        }
      />

      {detailQuery.isPending ? (
        <Card className="p-5 sm:p-6">
          <div className="space-y-4" aria-busy="true">
            <Skeleton height={28} width="40%" />
            <Skeleton height={180} />
          </div>
        </Card>
      ) : null}
      {detailQuery.isError ? (
        <Alert variant="error" title="Could not load client billing details." />
      ) : null}

      {!plan && !detailQuery.isPending ? (
        <div className="rounded-xl border border-dashed border-border-strong bg-surface-sunken p-6 text-center">
          <p className="text-sm text-text-body">This client has no billing plan yet.</p>
          {canMutate ? (
            <Button className="mt-3" variant="brand" onClick={() => navigate('/billing/plans/new')}>
              Create billing plan
            </Button>
          ) : null}
        </div>
      ) : null}

      {plan ? (
        <>
          {pendingLines.length > 0 ? (
            <div className="rounded-xl border border-status-warning-border bg-status-warning-bg px-4 py-3 text-sm text-status-warning-fg">
              <p className="font-semibold">Pending changes (apply on next billing cycle)</p>
              <ul className="mt-1 list-disc pl-5">
                {pendingLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <VolumeAllocationPanel
            capacity={capacityQuery.data}
            storage={storageQuery.data}
            reservedVolume={plan.reservedVolume}
            loading={storageQuery.isLoading || capacityQuery.isLoading}
            title="Client storage"
            description="Used storage = current inventory quantity × product volume (CBM)."
          />

          <section className="rounded-xl border border-border bg-surface-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-text-strong">Current plan</h3>
              <StatusBadge status={plan.active ? 'active' : 'paused'} />
              {company?.status === 'restricted' ? (
                <span className="badge badge-cancelled w-fit">restricted</span>
              ) : null}
            </div>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label="Client" value={company?.name ?? '—'} />
              <DetailField
                label="Plan type"
                value={
                  plan.planType === 'template'
                    ? `Template${plan.templateName ? ` · ${plan.templateName}` : ''}`
                    : 'Custom'
                }
              />
              <DetailField
                label="Reserved volume"
                value={`${formatDecimal(plan.reservedVolume, 2)} m³`}
              />
              <DetailField
                label="Fixed plan price"
                value={`${formatDecimal(plan.fixedSubscriptionFee)} ${CURRENCY}`}
              />
              <DetailField
                label="Inbound order price"
                value={`${formatDecimal(plan.inboundOrderFee)} ${CURRENCY}`}
              />
              <DetailField
                label="Outbound order price"
                value={`${formatDecimal(plan.outboundOrderFee)} ${CURRENCY}`}
              />
              <DetailField label="Billing cycle" value={`${plan.cycleLengthDays} days`} />
              <DetailField
                label="Auto-renewal"
                value={plan.autoRenew === false ? 'Off' : 'On'}
              />
              <DetailField label="Created date" value={formatDate(plan.createdAt)} />
            </dl>
          </section>

          <section className="rounded-xl border border-border bg-surface-card p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-text-strong">Current billing cycle</h3>
            {currentCycle ? (
              <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DetailField label="Start" value={formatDate(currentCycle.startsAt)} />
                <DetailField label="End" value={formatDate(currentCycle.endsAt)} />
                <DetailField label="Next renewal" value={formatDate(currentCycle.endsAt)} />
                <DetailField
                  label="Days remaining"
                  value={
                    daysLeft != null && daysLeft > 0
                      ? `${daysLeft} days`
                      : daysLeft === 0
                        ? 'Last day'
                        : 'Expired'
                  }
                />
                <DetailField label="Cycle status" value={currentCycle.status} />
              </dl>
            ) : (
              <p className="mt-2 text-sm text-text-muted">No active billing cycle for this client.</p>
            )}
          </section>

          <DataTable
            title="Cycle history"
            description="Recent billing cycles for this client."
            columns={cycleColumns}
            rows={cycles}
            rowKey={(r) => r.id}
            empty="No billing cycles yet."
          />

          <DataTable
            title="Recent invoices"
            description="Subscription invoices for this client."
            columns={invoiceColumns}
            rows={invoices}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/billing/invoices/${r.id}`)}
            empty="No invoices yet."
          />
        </>
      ) : null}
    </div>
  );
}
