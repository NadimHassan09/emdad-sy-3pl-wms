import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { Alert, Card, ListPageHeader, Skeleton } from '@ds';
import { BillingApi, type CreateManualInvoiceLinePayload } from '../../api/billing';
import { Button } from '../../components/Button';
import { SelectField } from '../../components/SelectField';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { useAuth } from '../../auth/AuthContext';
import { QK } from '../../constants/query-keys';
import {
  formatCycleLabel,
  formatDate,
  formatDecimal,
  humanizeInvoiceStatus,
  invoiceStatusClass,
  lineLabel,
  manualLines,
  orderChargeLines,
  parseRateSnapshot,
  systemLines,
} from '../../lib/billing-invoice-display';

const CURRENCY = 'SYP';

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-text-strong">{value}</dd>
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
      <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</h4>
      <table className="mt-2 min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase text-text-muted">
            <th className="py-2 pr-4">Description</th>
            <th className="py-2 pr-4">Qty</th>
            <th className="py-2 pr-4">Unit</th>
            <th className="py-2 pr-4">Total</th>
            {showActions ? <th className="py-2" /> : null}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="border-b border-border-subtle">
              <td className="py-2 pr-4">{lineLabel(line)}</td>
              <td className="py-2 pr-4 font-mono tabular-nums">{formatDecimal(line.quantity, 2)}</td>
              <td className="py-2 pr-4 font-mono tabular-nums">{formatDecimal(line.unitPrice, 2)}</td>
              <td className="py-2 pr-4 font-mono tabular-nums">{formatDecimal(line.totalPrice)}</td>
              {showActions && onRemove ? (
                <td className="py-2">
                  <Button
                    size="sm"
                    variant="danger"
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
  const snapshot = parseRateSnapshot(invoice?.billingCycle?.rateSnapshot);
  const lines = invoice?.lines ?? [];
  const cycle = invoice?.billingCycle;
  const isDraft = invoice?.status === 'draft';
  const isEditable =
    invoice?.status === 'draft' ||
    invoice?.status === 'unpaid' ||
    invoice?.status === 'open' ||
    invoice?.status === 'overdue';
  const isUnpaid =
    invoice?.status === 'unpaid' || invoice?.status === 'open' || invoice?.status === 'overdue';

  const [manualDesc, setManualDesc] = useState('');
  const [manualQty, setManualQty] = useState('1');
  const [manualUnit, setManualUnit] = useState('0');
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage' | ''>('');
  const [discountValue, setDiscountValue] = useState('');
  const [vatPercentage, setVatPercentage] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!invoice) return;
    setDiscountType(invoice.discountType ?? '');
    setDiscountValue(invoice.discountValue ?? '');
    setVatPercentage(invoice.vatPercentage ?? '');
    setNotes(invoice.notes ?? '');
  }, [invoice]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: [...QK.billing.invoices, id] });
    void qc.invalidateQueries({ queryKey: QK.billing.invoices });
  };

  const statusMut = useMutation({
    mutationFn: (status: 'paid' | 'cancelled' | 'unpaid') => BillingApi.updateInvoiceStatus(id, status),
    onSuccess: () => {
      invalidate();
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

  const deleteMut = useMutation({
    mutationFn: () => BillingApi.deleteInvoice(id),
    onSuccess: () => {
      toast.success('Invoice deleted.');
      void qc.invalidateQueries({ queryKey: QK.billing.invoices });
      window.history.back();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addLineMut = useMutation({
    mutationFn: (payload: CreateManualInvoiceLinePayload) => BillingApi.addManualLine(id, payload),
    onSuccess: () => {
      invalidate();
      setManualDesc('');
      setManualQty('1');
      setManualUnit('0');
      toast.success('Charge added.');
    },
    onError: () => toast.error('Could not add charge.'),
  });

  const removeLineMut = useMutation({
    mutationFn: (lineId: string) => BillingApi.removeManualLine(id, lineId),
    onSuccess: () => {
      invalidate();
      toast.success('Charge removed.');
    },
    onError: () => toast.error('Could not remove charge.'),
  });

  const updateInvoiceMut = useMutation({
    mutationFn: () =>
      BillingApi.updateInvoice(id, {
        discountType: discountType || null,
        discountValue: discountValue ? Number(discountValue) : null,
        vatPercentage: vatPercentage ? Number(vatPercentage) : undefined,
        notes: notes.trim() || null,
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

  const subscriptionLines = systemLines(lines).filter((l) => l.type === 'subscription');
  const otherSystemLines = systemLines(lines).filter((l) => l.type !== 'subscription');

  return (
    <div className="space-y-5 animate-enter">
      <Link
        to="/billing/invoices"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text-strong"
      >
        <i className="fa-solid fa-arrow-left rtl:rotate-180 text-xs" aria-hidden="true" />
        Back to invoices
      </Link>

      <ListPageHeader
        icon="fa-file-invoice"
        title={invoice ? `Invoice ${invoice.invoiceNumber}` : 'Invoice details'}
        subtitle={invoice?.company?.name ?? 'Subscription invoice'}
        actions={
          invoice ? (
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
                  Mark as paid
                </Button>
              ) : null}
              {canMutate && invoice.status !== 'cancelled' && invoice.status !== 'paid' ? (
                <Button
                  size="sm"
                  variant="danger"
                  loading={statusMut.isPending}
                  onClick={() => statusMut.mutate('cancelled')}
                >
                  Cancel invoice
                </Button>
              ) : null}
              {canMutate && (isDraft || invoice.status === 'cancelled') ? (
                <Button
                  size="sm"
                  variant="danger"
                  loading={deleteMut.isPending}
                  onClick={() => {
                    if (!window.confirm(`Delete invoice ${invoice.invoiceNumber}?`)) return;
                    deleteMut.mutate();
                  }}
                >
                  Delete
                </Button>
              ) : null}
            </div>
          ) : undefined
        }
      />

      {invoiceQuery.isPending ? (
        <Card className="p-5 sm:p-6">
          <div className="space-y-4" aria-busy="true">
            <Skeleton height={28} width="40%" />
            <Skeleton height={180} />
          </div>
        </Card>
      ) : null}
      {invoiceQuery.isError ? (
        <Alert variant="error" title="Could not load invoice." />
      ) : null}

      {invoice ? (
        <>
          <section className="rounded-xl border border-border bg-surface-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-text-strong">Invoice info</h3>
              <span className={`w-fit ${invoiceStatusClass(invoice.status)}`}>
                {humanizeInvoiceStatus(invoice.status)}
              </span>
            </div>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailField label="Client" value={invoice.company?.name ?? invoice.companyId} />
              <DetailField label="Billing period" value={formatCycleLabel(cycle)} />
              <DetailField
                label="Issue date"
                value={invoice.issuedAt ? formatDate(invoice.issuedAt) : '—'}
              />
              <DetailField
                label="Due date"
                value={invoice.dueDate ? formatDate(invoice.dueDate) : '—'}
              />
              <DetailField label="Payment status" value={humanizeInvoiceStatus(invoice.status)} />
              {snapshot ? (
                <>
                  <DetailField
                    label="Reserved volume"
                    value={`${formatDecimal(snapshot.reservedVolume, 2)} m³`}
                  />
                  <DetailField
                    label="Plan price"
                    value={`${formatDecimal(snapshot.fixedSubscriptionFee)} ${CURRENCY}`}
                  />
                </>
              ) : null}
            </dl>
          </section>

          <section className="rounded-xl border border-border bg-surface-card p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-text-strong">Charges</h3>
            <p className="mt-1 text-xs text-text-muted">
              Client, billing period, reserved volume, and base subscription lines are locked.
            </p>

            <LineTable title="Subscription (locked)" lines={subscriptionLines} />
            <LineTable title="System charges" lines={otherSystemLines} />
            <LineTable title="Order charges (VAS)" lines={orderChargeLines(lines)} />
            <LineTable
              title="Additional charges"
              lines={manualLines(lines)}
              showActions={canMutate && isEditable}
              onRemove={(lineId) => removeLineMut.mutate(lineId)}
              removingId={removeLineMut.isPending ? removeLineMut.variables : undefined}
            />

            {canMutate && isEditable ? (
              <form
                className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-4"
                onSubmit={handleAddManualLine}
              >
                <TextField
                  label="Additional charge description"
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
                    Add charge
                  </Button>
                </div>
              </form>
            ) : null}

            <div className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-text-body">Subtotal</span>
                <span className="font-mono tabular-nums">
                  {formatDecimal(invoice.subtotalAmount)} {CURRENCY}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-body">Discount</span>
                <span className="font-mono tabular-nums">
                  -{formatDecimal(invoice.discountAmount)} {CURRENCY}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-body">
                  VAT ({formatDecimal(invoice.vatPercentage, 2)}%)
                </span>
                <span className="font-mono tabular-nums">
                  {formatDecimal(invoice.vatAmount)} {CURRENCY}
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 font-semibold">
                <span>Grand total</span>
                <span className="font-mono tabular-nums text-lg">
                  {formatDecimal(invoice.grandTotal)} {CURRENCY}
                </span>
              </div>
            </div>

            {canMutate && isEditable ? (
              <form
                className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  updateInvoiceMut.mutate();
                }}
              >
                <SelectField
                  label="Discount type"
                  value={discountType}
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
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                />
                <TextField
                  label="VAT %"
                  type="number"
                  min={0}
                  step="0.01"
                  value={vatPercentage}
                  onChange={(e) => setVatPercentage(e.target.value)}
                />
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-text-body">Notes</label>
                  <textarea
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text-strong shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Internal or client-facing notes"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" size="sm" variant="secondary" loading={updateInvoiceMut.isPending}>
                    Save discounts, taxes & notes
                  </Button>
                </div>
              </form>
            ) : invoice.notes ? (
              <div className="mt-4 border-t border-border pt-4">
                <DetailField label="Notes" value={invoice.notes} />
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
