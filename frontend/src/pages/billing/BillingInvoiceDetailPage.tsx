import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { BillingApi } from '../../api/billing';
import { Button } from '../../components/Button';
import { useToast } from '../../components/ToastProvider';
import { useAuth } from '../../auth/AuthContext';
import { CompaniesApi } from '../../api/companies';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { QK } from '../../constants/query-keys';
import {
  formatCycleLabel,
  formatDate,
  formatDecimal,
  lineTotalByType,
  parseRateSnapshot,
  renewalStatusLabel,
} from '../../lib/billing-invoice-display';
import { daysRemainingFromEnd } from '../../lib/billing-plan-overview';
import { openBillingInvoicePrintPdf } from '../../lib/billing-invoice-print';

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{value}</dd>
    </div>
  );
}

function ChargeRow({ label, amount }: { label: string; amount: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-700">{label}</span>
      <span className="font-mono tabular-nums text-slate-900">{formatDecimal(amount)}</span>
    </div>
  );
}

export function BillingInvoiceDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const canMutate = user?.role === 'super_admin' || user?.role === 'wh_manager';

  const invoiceQuery = useQuery({
    queryKey: [...QK.billing.invoices, id],
    queryFn: () => BillingApi.getInvoice(id),
    enabled: !!id,
  });

  const invoice = invoiceQuery.data;

  const companyQuery = useQuery({
    queryKey: [...QK.companies, invoice?.companyId],
    queryFn: () => CompaniesApi.get(invoice!.companyId),
    enabled: !!invoice?.companyId,
  });

  const snapshot = parseRateSnapshot(invoice?.billingCycle?.rateSnapshot);
  const lines = invoice?.lines ?? [];
  const cycle = invoice?.billingCycle;
  const daysLeft = cycle ? daysRemainingFromEnd(cycle.endsAt) : null;

  const statusMut = useMutation({
    mutationFn: (status: 'paid' | 'cancelled' | 'open') => BillingApi.updateInvoiceStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK.billing.invoices });
      toast.success('Invoice status updated.');
    },
    onError: () => toast.error('Could not update invoice status.'),
  });

  const handleExportPdf = () => {
    if (!invoice) return;
    const ok = openBillingInvoicePrintPdf({
      invoiceNumber: invoice.invoiceNumber,
      companyName: companyQuery.data?.name ?? invoice.companyId,
      status: invoice.status,
      cycle: cycle
        ? { startsAt: cycle.startsAt, endsAt: cycle.endsAt, status: cycle.status }
        : undefined,
      createdAt: invoice.createdAt,
      issuedAt: invoice.issuedAt,
      totalAmount: invoice.totalAmount,
      lines,
      snapshot,
      daysRemaining: daysLeft,
    });
    if (!ok) toast.error('Could not open print dialog. Allow pop-ups and try again.');
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link to="/billing/invoices" className="hover:underline">
          ← Back to invoices
        </Link>
      </div>

      <PageHeader
        title={invoice ? `Invoice ${invoice.invoiceNumber}` : 'Invoice details'}
        description={companyQuery.data?.name}
      />

      {invoiceQuery.isPending ? <p className="text-sm text-slate-500">Loading invoice…</p> : null}
      {invoiceQuery.isError ? (
        <p className="text-sm text-rose-600">Could not load invoice.</p>
      ) : null}

      {invoice ? (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Summary</h3>
                <StatusBadge status={invoice.status} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={handleExportPdf}>
                  Export PDF
                </Button>
              {canMutate ? (
                <>
                  {(invoice.status === 'open' || invoice.status === 'overdue') ? (
                    <Button
                      size="sm"
                      variant="primary"
                      loading={statusMut.isPending}
                      onClick={() => statusMut.mutate('paid')}
                    >
                      Mark paid
                    </Button>
                  ) : null}
                  {invoice.status !== 'cancelled' && invoice.status !== 'paid' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={statusMut.isPending}
                      onClick={() => statusMut.mutate('cancelled')}
                    >
                      Cancel invoice
                    </Button>
                  ) : null}
                </>
              ) : null}
              </div>
            </div>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailField label="Client" value={companyQuery.data?.name ?? invoice.companyId} />
              <DetailField label="Billing cycle" value={formatCycleLabel(cycle)} />
              <DetailField label="Created" value={formatDate(invoice.createdAt)} />
              <DetailField
                label="Issued"
                value={invoice.issuedAt ? formatDate(invoice.issuedAt) : '—'}
              />
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Billing plan snapshot</h3>
            {snapshot ? (
              <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <DetailField
                  label="Fixed subscription fee"
                  value={formatDecimal(snapshot.fixedSubscriptionFee)}
                />
                <DetailField
                  label="Inbound order fee"
                  value={formatDecimal(snapshot.inboundOrderFee, 4)}
                />
                <DetailField
                  label="Outbound order fee"
                  value={formatDecimal(snapshot.outboundOrderFee, 4)}
                />
                <DetailField label="Packaging fee" value={formatDecimal(snapshot.packagingFee, 4)} />
                <DetailField
                  label="Quality check fee"
                  value={formatDecimal(snapshot.qualityCheckFee, 4)}
                />
                <DetailField
                  label="Excess volume / day"
                  value={formatDecimal(snapshot.excessVolumeFeePerDay, 4)}
                />
                <DetailField
                  label="Excess weight / day"
                  value={formatDecimal(snapshot.excessWeightFeePerDay, 4)}
                />
                <DetailField
                  label="Reserved volume"
                  value={`${formatDecimal(snapshot.reservedVolume, 4)} CBM`}
                />
                <DetailField
                  label="Reserved weight"
                  value={`${formatDecimal(snapshot.reservedWeight, 4)} kg`}
                />
                {snapshot.snapshottedAt ? (
                  <DetailField
                    label="Snapshotted at"
                    value={formatDate(snapshot.snapshottedAt)}
                  />
                ) : null}
              </dl>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No rate snapshot on this billing cycle.</p>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Invoice lines</h3>
            <div className="mt-3">
              <ChargeRow label="Fixed subscription" amount={lineTotalByType(lines, 'subscription')} />
              <ChargeRow label="Inbound totals" amount={lineTotalByType(lines, 'inbound')} />
              <ChargeRow label="Outbound totals" amount={lineTotalByType(lines, 'outbound')} />
              <ChargeRow label="Packaging totals" amount={lineTotalByType(lines, 'packaging')} />
              <ChargeRow
                label="Quality check totals"
                amount={lineTotalByType(lines, 'quality_check')}
              />
              <ChargeRow label="Volume charges" amount={lineTotalByType(lines, 'excess_volume')} />
              <ChargeRow label="Weight charges" amount={lineTotalByType(lines, 'excess_weight')} />
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3">
              <span className="text-sm font-semibold text-slate-900">Grand total</span>
              <span className="text-lg font-bold tabular-nums text-slate-900">
                {formatDecimal(invoice.totalAmount)}
              </span>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Renewal status</h3>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <DetailField
                label="Cycle status"
                value={renewalStatusLabel(cycle?.status)}
              />
              <DetailField
                label="Cycle ends"
                value={cycle ? formatDate(cycle.endsAt) : '—'}
              />
              <DetailField
                label="Days remaining"
                value={
                  daysLeft != null
                    ? daysLeft > 0
                      ? `${daysLeft} days`
                      : 'Expired'
                    : '—'
                }
              />
            </dl>
            {cycle?.status === 'renewed' ? (
              <p className="mt-3 text-xs text-emerald-700">
                This cycle is marked for renewal. The next cycle will be created automatically when
                the current period ends.
              </p>
            ) : cycle?.status === 'active' ? (
              <p className="mt-3 text-xs text-slate-500">
                Not yet marked for renewal. Use Renew on the billing plans page before expiry to
                avoid account restriction.
              </p>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
