import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { BillingApi } from '../../api/billing';
import { VolumeAllocationPanel } from '../../components/billing/VolumeAllocationPanel';
import { Button } from '../../components/Button';
import { DataTable, type Column } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
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

const CURRENCY = 'SYP';

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{value}</dd>
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
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link to="/billing/plans" className="hover:underline">
          ← Back to billing plans
        </Link>
      </div>

      <PageHeader
        title={company ? `${company.name} — billing plan` : 'Client billing plan'}
        description="Subscription storage plan, current cycle, history, and invoices."
        actions={
          canMutate ? (
            <div className="flex flex-wrap gap-2">
              {!plan ? (
                <Button variant="brand" onClick={() => navigate('/billing/plans/new')}>
                  Create plan
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => navigate(`/billing/plans/${clientId}/edit`)}>
                  Edit plan
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      {detailQuery.isPending ? <p className="text-sm text-slate-500">Loading billing details…</p> : null}
      {detailQuery.isError ? (
        <p className="text-sm text-rose-600">Could not load client billing details.</p>
      ) : null}

      {!plan && !detailQuery.isPending ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <p className="text-sm text-slate-600">This client has no billing plan yet.</p>
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
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
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

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Current plan</h3>
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
                label="Subscription price"
                value={`${formatDecimal(plan.fixedSubscriptionFee)} ${CURRENCY}`}
              />
              <DetailField label="Billing cycle" value={`${plan.cycleLengthDays} days`} />
              <DetailField label="Created date" value={formatDate(plan.createdAt)} />
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Current billing cycle</h3>
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
              <p className="mt-2 text-sm text-slate-500">No active billing cycle for this client.</p>
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
