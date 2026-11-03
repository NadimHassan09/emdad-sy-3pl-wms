import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { BillingApi, type InvoiceBreakdownSection } from '../../api/billing';
import { Button } from '../Button';
import { useToast } from '../ToastProvider';

const KIND_LABEL: Record<InvoiceBreakdownSection['kind'], string> = {
  inbound: 'Inbound orders',
  outbound: 'Outbound orders',
  oms: 'Online (OMS) orders',
};

const money = (v: string | null | undefined) => (v == null ? '—' : `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);

/**
 * Order counts, statuses and fees behind an on-demand invoice, with the balance statement.
 * Admin view also shows the external carrier cost and margin; the client portal never does.
 */
export function InvoiceBreakdownPanel({
  invoiceId,
  invoiceStatus,
  canSettle,
}: {
  invoiceId: string;
  invoiceStatus: string;
  canSettle: boolean;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['billing', 'invoice-breakdown', invoiceId],
    queryFn: () => BillingApi.getInvoiceBreakdown(invoiceId),
  });
  const settle = useMutation({
    mutationFn: () => BillingApi.settleInvoice(invoiceId),
    onSuccess: (r) => {
      toast.success(`Deducted ${money(r.deducted)} from the client balance. Remaining due ${money(r.remainingDue)}.`);
      void qc.invalidateQueries({ queryKey: ['billing'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const data = query.data;
  if (query.isLoading) return <p className="text-sm text-text-muted">Loading order breakdown…</p>;
  if (!data || data.sections.every((s) => s.orderCount === 0)) return null;

  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-text-strong">Orders on this invoice</h2>
        {canSettle && invoiceStatus === 'unpaid' && !data.statement ? (
          <Button
            type="button"
            variant="secondary"
            loading={settle.isPending}
            onClick={() => {
              if (!window.confirm('Deduct this invoice from the client available balance?')) return;
              settle.mutate();
            }}
          >
            Deduct from client balance
          </Button>
        ) : null}
      </div>

      {data.statement ? (
        <div className="rounded-lg bg-surface-sunken p-3 text-sm">
          <p className="font-medium text-text-strong">Balance statement</p>
          <p className="text-text-muted">
            Balance before {money(data.statement.balanceBefore)} · deducted {money(data.statement.deducted)} · balance after{' '}
            {money(data.statement.balanceAfter)}
            {Number(data.statement.remainingDue) > 0 ? ` · still due ${money(data.statement.remainingDue)}` : ' · fully settled'}
          </p>
        </div>
      ) : null}

      {data.sections
        .filter((s) => s.orderCount > 0)
        .map((s) => {
          const admin = s.orders.some((o) => 'carrierCostUsd' in o);
          return (
            <div key={s.kind} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-text-strong">
                  {KIND_LABEL[s.kind]} ({s.orderCount})
                </h3>
                {Object.entries(s.statusCounts).map(([status, n]) => (
                  <span key={status} className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-text-muted">
                    {status.replace(/_/g, ' ')}: {n}
                  </span>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase text-text-muted">
                      <th className="px-3 py-2">Order</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Lines</th>
                      <th className="px-3 py-2 text-right">Weight kg</th>
                      {s.billed ? <th className="px-3 py-2 text-right">Fulfillment</th> : null}
                      {s.kind === 'oms' ? <th className="px-3 py-2 text-right">Shipping fee</th> : null}
                      {admin ? <th className="px-3 py-2 text-right">Carrier cost</th> : null}
                      {admin ? <th className="px-3 py-2 text-right">Margin</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {s.orders.map((o) => (
                      <tr key={`${s.kind}-${o.orderNumber}`} className="border-b border-border/60">
                        <td className="px-3 py-2 font-mono">{o.orderNumber}</td>
                        <td className="px-3 py-2">{o.status.replace(/_/g, ' ')}</td>
                        <td className="px-3 py-2 text-right">{o.linesCount}</td>
                        <td className="px-3 py-2 text-right">{o.weightKg}</td>
                        {s.billed ? <td className="px-3 py-2 text-right">{o.charged ? money(o.fulfillmentFee) : '—'}</td> : null}
                        {s.kind === 'oms' ? (
                          <td className="px-3 py-2 text-right">
                            {o.shippingFee == null ? '—' : o.shippingFeeAlreadySettled ? `${money(o.shippingFee)} (already deducted)` : money(o.shippingFee)}
                          </td>
                        ) : null}
                        {admin ? <td className="px-3 py-2 text-right">{money(o.carrierCostUsd)}</td> : null}
                        {admin ? <td className="px-3 py-2 text-right">{money(o.marginUsd)}</td> : null}
                      </tr>
                    ))}
                  </tbody>
                  {s.billed || s.shippingTotal ? (
                    <tfoot>
                      <tr className="font-semibold">
                        <td className="px-3 py-2" colSpan={4}>
                          Total
                        </td>
                        {s.billed ? <td className="px-3 py-2 text-right">{money(s.fulfillmentTotal)}</td> : null}
                        {s.kind === 'oms' ? <td className="px-3 py-2 text-right">{money(s.shippingTotal)}</td> : null}
                        {admin ? <td colSpan={2} /> : null}
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>
            </div>
          );
        })}
    </section>
  );
}
