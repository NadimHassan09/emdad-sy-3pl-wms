import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { BillingApi, type CreateManualInvoiceLinePayload } from '../../api/billing';
import { Button } from '../../components/Button';
import { SelectField } from '../../components/SelectField';
import { TextField } from '../../components/TextField';
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
  lineLabel,
  manualLines,
  orderChargeLines,
  parseRateSnapshot,
  renewalStatusLabel,
  systemLines,
} from '../../lib/billing-invoice-display';
import { daysRemainingFromEnd } from '../../lib/billing-plan-overview';

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{value}</dd>
    </div>
  );
}

function LineTable({
  title,
  lines,
  showActions,
  onRemove,
  removingId,
}: {
  title: string;
  lines: ReturnType<typeof systemLines>;
  showActions?: boolean;
  onRemove?: (id: string) => void;
  removingId?: string;
}) {
  if (!lines.length) return null;
  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <table className="mt-2 min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
            <th className="py-2 pr-4">Description</th>
            <th className="py-2 pr-4">Qty</th>
            <th className="py-2 pr-4">Unit</th>
            <th className="py-2 pr-4">Total</th>
            {showActions ? <th className="py-2" /> : null}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="border-b border-slate-100">
              <td className="py-2 pr-4">{lineLabel(line)}</td>
              <td className="py-2 pr-4 font-mono tabular-nums">{formatDecimal(line.quantity, 2)}</td>
              <td className="py-2 pr-4 font-mono tabular-nums">{formatDecimal(line.unitPrice, 2)}</td>
              <td className="py-2 pr-4 font-mono tabular-nums">{formatDecimal(line.totalPrice)}</td>
              {showActions && onRemove ? (
                <td className="py-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={removingId === line.id}
                    onClick={() => onRemove(line.id)}
                  >
                    Remove
                  </Button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
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
  const isDraft = invoice?.status === 'draft';
  const isUnpaid =
    invoice?.status === 'unpaid' || invoice?.status === 'open' || invoice?.status === 'overdue';

  const [manualDesc, setManualDesc] = useState('');
  const [manualQty, setManualQty] = useState('1');
  const [manualUnit, setManualUnit] = useState('0');
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage' | ''>('');
  const [discountValue, setDiscountValue] = useState('');
  const [vatPercentage, setVatPercentage] = useState('');

  const invalidate = () => void qc.invalidateQueries({ queryKey: [...QK.billing.invoices, id] });

  const statusMut = useMutation({
    mutationFn: (status: 'paid' | 'cancelled' | 'unpaid') => BillingApi.updateInvoiceStatus(id, status),
    onSuccess: () => {
      invalidate();
      void qc.invalidateQueries({ queryKey: QK.billing.invoices });
      toast.success('Invoice status updated.');
    },
    onError: () => toast.error('Could not update invoice status.'),
  });

  const issueMut = useMutation({
    mutationFn: () => BillingApi.issueInvoice(id),
    onSuccess: () => {
      invalidate();
      toast.success('Invoice issued.');
    },
    onError: () => toast.error('Could not issue invoice.'),
  });

  const addLineMut = useMutation({
    mutationFn: (payload: CreateManualInvoiceLinePayload) => BillingApi.addManualLine(id, payload),
    onSuccess: () => {
      invalidate();
      setManualDesc('');
      setManualQty('1');
      setManualUnit('0');
      toast.success('Line added.');
    },
    onError: () => toast.error('Could not add line.'),
  });

  const removeLineMut = useMutation({
    mutationFn: (lineId: string) => BillingApi.removeManualLine(id, lineId),
    onSuccess: () => {
      invalidate();
      toast.success('Line removed.');
    },
    onError: () => toast.error('Could not remove line.'),
  });

  const updateInvoiceMut = useMutation({
    mutationFn: () =>
      BillingApi.updateInvoice(id, {
        discountType: discountType || null,
        discountValue: discountValue ? Number(discountValue) : null,
        vatPercentage: vatPercentage ? Number(vatPercentage) : undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success('Invoice updated.');
    },
    onError: () => toast.error('Could not update invoice.'),
  });

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    try {
      const blob = await BillingApi.downloadInvoicePdf(invoice.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoiceNumber || 'invoice'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not download PDF.');
    }
  };

  const handleAddManualLine = (e: FormEvent) => {
    e.preventDefault();
    if (!manualDesc.trim()) {
      toast.error('Description is required.');
      return;
    }
    addLineMut.mutate({
      description: manualDesc.trim(),
      quantity: Number(manualQty) || 0,
      unitPrice: Number(manualUnit) || 0,
    });
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
        description={
          invoice?.invoiceSource === 'ad_hoc'
            ? `${companyQuery.data?.name ?? ''} · Ad-hoc invoice`
            : companyQuery.data?.name
        }
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
                {invoice.invoiceSource === 'ad_hoc' ? (
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Ad-hoc</span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => void handleDownloadPdf()}>
                  Download PDF
                </Button>
                {canMutate && isDraft ? (
                  <Button size="sm" variant="primary" loading={issueMut.isPending} onClick={() => issueMut.mutate()}>
                    Issue invoice
                  </Button>
                ) : null}
                {canMutate && isUnpaid ? (
                  <Button
                    size="sm"
                    variant="primary"
                    loading={statusMut.isPending}
                    onClick={() => statusMut.mutate('paid')}
                  >
                    Mark paid
                  </Button>
                ) : null}
                {canMutate && invoice.status !== 'cancelled' && invoice.status !== 'paid' ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={statusMut.isPending}
                    onClick={() => statusMut.mutate('cancelled')}
                  >
                    Cancel invoice
                  </Button>
                ) : null}
              </div>
            </div>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailField label="Client" value={companyQuery.data?.name ?? invoice.companyId} />
              <DetailField
                label="Billing cycle"
                value={invoice.invoiceSource === 'ad_hoc' ? '—' : formatCycleLabel(cycle)}
              />
              <DetailField label="Created" value={formatDate(invoice.createdAt)} />
              <DetailField
                label="Issue date"
                value={invoice.issuedAt ? formatDate(invoice.issuedAt) : '—'}
              />
              <DetailField
                label="Due date"
                value={invoice.dueDate ? formatDate(invoice.dueDate) : '—'}
              />
            </dl>
          </section>

          {snapshot && invoice.invoiceSource !== 'ad_hoc' ? (
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Billing plan snapshot</h3>
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
                  label="Outbound base fee"
                  value={formatDecimal(snapshot.outboundBaseFee)}
                />
                <DetailField
                  label="Outbound included items"
                  value={String(snapshot.outboundIncludedItems)}
                />
                <DetailField
                  label="Outbound additional item fee"
                  value={formatDecimal(snapshot.outboundAdditionalItemFee)}
                />
                <DetailField label="Packaging fee" value={formatDecimal(snapshot.packagingFee, 4)} />
              </dl>
            </section>
          ) : null}

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Invoice lines</h3>
            <LineTable title="System charges" lines={systemLines(lines)} />
            <LineTable title="Order charges (VAS)" lines={orderChargeLines(lines)} />
            <LineTable
              title="Manual charges"
              lines={manualLines(lines)}
              showActions={canMutate && isDraft}
              onRemove={(lineId) => removeLineMut.mutate(lineId)}
              removingId={removeLineMut.isPending ? removeLineMut.variables : undefined}
            />

            {canMutate && isDraft ? (
              <form className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-4" onSubmit={handleAddManualLine}>
                <TextField
                  label="Manual line description"
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                  className="sm:col-span-2"
                />
                <TextField
                  label="Qty"
                  type="number"
                  min={0}
                  step="0.01"
                  value={manualQty}
                  onChange={(e) => setManualQty(e.target.value)}
                />
                <TextField
                  label="Unit price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={manualUnit}
                  onChange={(e) => setManualUnit(e.target.value)}
                />
                <div className="sm:col-span-4">
                  <Button type="submit" size="sm" variant="brand" loading={addLineMut.isPending}>
                    Add manual line
                  </Button>
                </div>
              </form>
            ) : null}

            <div className="mt-6 space-y-2 border-t border-slate-200 pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-mono tabular-nums">{formatDecimal(invoice.subtotalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Discount</span>
                <span className="font-mono tabular-nums">-{formatDecimal(invoice.discountAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">VAT ({formatDecimal(invoice.vatPercentage, 2)}%)</span>
                <span className="font-mono tabular-nums">{formatDecimal(invoice.vatAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold">
                <span>Grand total</span>
                <span className="font-mono tabular-nums text-lg">{formatDecimal(invoice.grandTotal)}</span>
              </div>
            </div>

            {canMutate && isDraft ? (
              <form
                className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  updateInvoiceMut.mutate();
                }}
              >
                <SelectField
                  label="Discount type"
                  value={discountType || invoice.discountType || ''}
                  onChange={(e) => setDiscountType(e.target.value as 'fixed' | 'percentage' | '')}
                  options={[
                    { value: '', label: 'None' },
                    { value: 'fixed', label: 'Fixed amount' },
                    { value: 'percentage', label: 'Percentage' },
                  ]}
                />
                <TextField
                  label="Discount value"
                  type="number"
                  min={0}
                  step="0.01"
                  value={discountValue || invoice.discountValue || ''}
                  onChange={(e) => setDiscountValue(e.target.value)}
                />
                <TextField
                  label="VAT %"
                  type="number"
                  min={0}
                  step="0.01"
                  value={vatPercentage || invoice.vatPercentage || ''}
                  onChange={(e) => setVatPercentage(e.target.value)}
                />
                <div className="sm:col-span-3">
                  <Button type="submit" size="sm" variant="secondary" loading={updateInvoiceMut.isPending}>
                    Apply discount & VAT
                  </Button>
                </div>
              </form>
            ) : null}
          </section>

          {cycle ? (
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Renewal status</h3>
              <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                <DetailField label="Cycle status" value={renewalStatusLabel(cycle?.status)} />
                <DetailField label="Cycle ends" value={formatDate(cycle.endsAt)} />
                <DetailField
                  label="Days remaining"
                  value={
                    daysLeft != null ? (daysLeft > 0 ? `${daysLeft} days` : 'Expired') : '—'
                  }
                />
              </dl>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
