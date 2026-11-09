import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  BillingApi,
  type IncentiveCheckResult,
  type InvoiceBreakdownSection,
  type StorageUsagePreview,
} from '../../api/billing';
import { OmsApi } from '../../api/oms';
import { Button } from '../Button';
import { useToast } from '../ToastProvider';

const KIND_LABEL: Record<InvoiceBreakdownSection['kind'], string> = {
  inbound: 'Inbound orders',
  outbound: 'Outbound orders',
  oms: 'OMS orders',
};

const money = (v: string | number | null | undefined) =>
  v == null || v === ''
    ? '—'
    : `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function EditableMoneyCell({
  value,
  disabled,
  onCommit,
}: {
  value: string | null | undefined;
  disabled?: boolean;
  onCommit: (next: number) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [busy, setBusy] = useState(false);

  if (disabled) {
    return <span className="tabular-nums">{money(value)}</span>;
  }

  if (!editing) {
    return (
      <button
        type="button"
        className="tabular-nums text-primary underline-offset-2 hover:underline"
        onClick={() => {
          setDraft(value ?? '0');
          setEditing(true);
        }}
      >
        {money(value)}
      </button>
    );
  }

  return (
    <input
      type="number"
      step="0.01"
      min="0"
      className="w-24 rounded border border-border bg-surface-card px-1.5 py-0.5 text-right text-sm tabular-nums"
      value={draft}
      disabled={busy}
      autoFocus
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const n = Number(draft);
        if (!Number.isFinite(n) || n < 0) {
          setEditing(false);
          return;
        }
        setBusy(true);
        void Promise.resolve(onCommit(n))
          .catch(() => undefined)
          .finally(() => {
            setBusy(false);
            setEditing(false);
          });
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setEditing(false);
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

/**
 * Order tables + storage/incentive controls for the redesigned admin invoice.
 * Carrier cost and margin stay admin-only (hidden on the client portal).
 */
export function InvoiceBreakdownPanel({
  invoiceId,
  invoiceStatus,
  canSettle,
  companyId,
  periodFrom,
  periodTo,
  canEdit,
}: {
  invoiceId: string;
  invoiceStatus: string;
  canSettle: boolean;
  companyId?: string;
  periodFrom?: string | null;
  periodTo?: string | null;
  canEdit?: boolean;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [forceEdit, setForceEdit] = useState(false);
  const [storagePreview, setStoragePreview] = useState<StorageUsagePreview | null>(null);
  const [incentivePreview, setIncentivePreview] = useState<IncentiveCheckResult | null>(null);
  const editable = Boolean(canEdit) && (invoiceStatus === 'draft' || forceEdit);

  const query = useQuery({
    queryKey: ['billing', 'invoice-breakdown', invoiceId],
    queryFn: () => BillingApi.getInvoiceBreakdown(invoiceId),
  });
  const settle = useMutation({
    mutationFn: () => BillingApi.settleInvoice(invoiceId),
    onSuccess: (r) => {
      toast.success(
        `Deducted ${money(r.deducted)} from the client balance. Remaining due ${money(r.remainingDue)}.`,
      );
      void qc.invalidateQueries({ queryKey: ['billing'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['billing', 'invoice-breakdown', invoiceId] });
    void qc.invalidateQueries({ queryKey: ['billing'] });
  };

  const data = query.data;

  const grand = useMemo(() => {
    if (!data) return null;
    let inboundF = 0;
    let outboundF = 0;
    let omsF = 0;
    let omsShip = 0;
    let omsCarrier = 0;
    for (const s of data.sections) {
      for (const o of s.orders) {
        const f = Number(o.fulfillmentFee ?? 0);
        if (s.kind === 'inbound') inboundF += f;
        if (s.kind === 'outbound') outboundF += f;
        if (s.kind === 'oms') {
          omsF += f;
          omsShip += o.shippingFeeAlreadySettled ? 0 : Number(o.shippingFee ?? 0);
          omsCarrier += Number(o.carrierCostUsd ?? 0);
        }
      }
    }
    const storage = storagePreview?.amount ?? 0;
    const incentive = incentivePreview?.discountAmount ?? 0;
    const clientTotal = inboundF + outboundF + omsF + omsShip + storage + incentive;
    return {
      inboundF,
      outboundF,
      omsF,
      omsShip,
      omsCarrier,
      storage,
      incentive,
      clientTotal,
      margin: clientTotal - omsCarrier,
    };
  }, [data, storagePreview, incentivePreview]);

  if (query.isLoading) return <p className="text-sm text-text-muted">Loading order breakdown…</p>;
  if (!data || data.sections.every((s) => s.orderCount === 0)) return null;

  const from =
    periodFrom?.slice(0, 10) ||
    (typeof data.period.from === 'string' ? data.period.from.slice(0, 10) : '') ||
    '';
  const to =
    periodTo?.slice(0, 10) ||
    (typeof data.period.to === 'string' ? data.period.to.slice(0, 10) : '') ||
    '';

  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-text-strong">Orders on this invoice</h2>
        <div className="flex flex-wrap gap-2">
          {canEdit && invoiceStatus !== 'draft' && !forceEdit ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => setForceEdit(true)}>
              Edit invoice
            </Button>
          ) : null}
          {forceEdit ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => setForceEdit(false)}>
              Lock editing
            </Button>
          ) : null}
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
      </div>

      {data.statement ? (
        <div className="rounded-lg bg-surface-sunken p-3 text-sm">
          <p className="font-medium text-text-strong">Balance statement</p>
          <p className="text-text-muted">
            Balance before {money(data.statement.balanceBefore)} · deducted {money(data.statement.deducted)} ·
            balance after {money(data.statement.balanceAfter)}
            {Number(data.statement.remainingDue) > 0
              ? ` · still due ${money(data.statement.remainingDue)}`
              : ' · fully settled'}
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
                  <span
                    key={status}
                    className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-text-muted"
                  >
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
                      <th className="px-3 py-2 text-right">Fulfillment</th>
                      {s.kind === 'oms' ? (
                        <th className="px-3 py-2 text-right">EMDAD shipping</th>
                      ) : null}
                      {admin ? <th className="px-3 py-2 text-right">Carrier cost</th> : null}
                      {admin ? <th className="px-3 py-2 text-right">Margin</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {s.orders.map((o) => (
                      <tr key={`${s.kind}-${o.orderNumber}`} className="border-b border-border/60">
                        <td className="px-3 py-2 font-mono">{o.orderNumber}</td>
                        <td className="px-3 py-2">{o.status.replace(/_/g, ' ')}</td>
                        <td className="px-3 py-2 text-right">
                          <EditableMoneyCell
                            value={o.fulfillmentFee}
                            disabled={!editable || !o.orderItemId}
                            onCommit={async (next) => {
                              if (!o.orderItemId) return;
                              await BillingApi.updateInvoiceOrderItem(invoiceId, o.orderItemId, {
                                fulfillmentFee: next,
                                reason: 'Invoice page edit',
                              });
                              invalidate();
                              toast.success('Fulfillment cost updated.');
                            }}
                          />
                        </td>
                        {s.kind === 'oms' ? (
                          <td className="px-3 py-2 text-right">
                            <EditableMoneyCell
                              value={o.shippingFee}
                              disabled={!editable || !o.orderId}
                              onCommit={async (next) => {
                                if (!o.orderId || !o.orderItemId) return;
                                await OmsApi.adjustShippingFee(o.orderId, {
                                  shippingFee: next,
                                  reason: 'Invoice page edit',
                                });
                                await BillingApi.updateInvoiceOrderItem(invoiceId, o.orderItemId, {
                                  shippingFee: next,
                                  reason: 'Invoice page edit',
                                });
                                invalidate();
                                toast.success('Shipping fee updated on order + invoice.');
                              }}
                            />
                          </td>
                        ) : null}
                        {admin ? (
                          <td className="px-3 py-2 text-right">
                            <EditableMoneyCell
                              value={o.carrierCostUsd}
                              disabled={!editable || !o.orderId}
                              onCommit={async (next) => {
                                if (!o.orderId || !o.orderItemId) return;
                                await OmsApi.adjustCarrierCost(o.orderId, {
                                  carrierCostUsd: next,
                                  reason: 'Invoice page edit',
                                });
                                await BillingApi.updateInvoiceOrderItem(invoiceId, o.orderItemId, {
                                  carrierCostUsd: next,
                                  reason: 'Invoice page edit',
                                });
                                invalidate();
                                toast.success('Carrier cost updated.');
                              }}
                            />
                          </td>
                        ) : null}
                        {admin ? (
                          <td className="px-3 py-2 text-right">{money(o.marginUsd)}</td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

      {companyId ? (
        <div className="grid gap-3 border-t border-border pt-4 md:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-text-strong">Storage fee</h3>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!editable}
                onClick={() => {
                  void BillingApi.getStorageUsage(companyId, to || undefined)
                    .then((r) => {
                      setStoragePreview(r);
                      toast.success(`Storage: ${r.totalCbm.toFixed(3)} m³ → ${money(r.amount)}`);
                    })
                    .catch((e: Error) => toast.error(e.message || 'Could not calculate storage.'));
                }}
              >
                Calculate storage
              </Button>
            </div>
            {storagePreview ? (
              <>
                <p className="text-sm text-text-muted">
                  {storagePreview.totalCbm.toFixed(3)} m³ × ${storagePreview.rateUsd}/m³ ={' '}
                  {money(storagePreview.amount)}
                </p>
                {storagePreview.lines.some((l) => l.missingDimensions) ? (
                  <p className="text-xs text-amber-700">
                    Some products are missing dimensions and contribute 0 CBM.
                  </p>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  disabled={!editable || storagePreview.amount <= 0}
                  onClick={() => {
                    void BillingApi.addManualLine(invoiceId, {
                      description: `Storage ${storagePreview.totalCbm.toFixed(3)} m³ @ $${storagePreview.rateUsd}/m³`,
                      quantity: storagePreview.totalCbm,
                      unitPrice: storagePreview.rateUsd,
                      type: 'storage_fee',
                    })
                      .then(() => {
                        invalidate();
                        toast.success('Storage line added.');
                      })
                      .catch(() => toast.error('Could not add storage line.'));
                  }}
                >
                  Add to invoice
                </Button>
              </>
            ) : (
              <p className="text-xs text-text-muted">Uses live on-hand stock × product dimensions.</p>
            )}
          </div>

          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-text-strong">Incentive discount</h3>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!editable || !from || !to}
                onClick={() => {
                  void BillingApi.getIncentiveCheck(companyId, from, to)
                    .then((r) => {
                      setIncentivePreview(r);
                      if (r.qualifies) {
                        toast.success(
                          `${r.deliveredCount} delivered → ${money(r.discountAmount)} discount`,
                        );
                      } else {
                        toast.success(
                          `${r.deliveredCount} delivered — need ${r.needMore} more to qualify.`,
                        );
                      }
                    })
                    .catch((e: Error) => toast.error(e.message || 'Could not check incentive.'));
                }}
              >
                Check incentive
              </Button>
            </div>
            {incentivePreview ? (
              <>
                <p className="text-sm text-text-muted">
                  {incentivePreview.deliveredCount} delivered / {incentivePreview.threshold} threshold
                  {incentivePreview.qualifies
                    ? ` · ${incentivePreview.discountPct}% of ${money(incentivePreview.fulfillmentTotal)} = ${money(incentivePreview.discountAmount)}`
                    : ` · need ${incentivePreview.needMore} more`}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  disabled={!editable || !incentivePreview.qualifies}
                  onClick={() => {
                    void BillingApi.addManualLine(invoiceId, {
                      description: incentivePreview.chargeLineLabel,
                      quantity: 1,
                      unitPrice: incentivePreview.discountAmount,
                    })
                      .then(() => {
                        invalidate();
                        toast.success('Incentive discount added.');
                      })
                      .catch(() => toast.error('Could not add discount line.'));
                  }}
                >
                  Add discount to invoice
                </Button>
              </>
            ) : (
              <p className="text-xs text-text-muted">20% when ≥500 OMS orders delivered in the period.</p>
            )}
          </div>
        </div>
      ) : null}

      {grand ? (
        <div className="rounded-lg bg-surface-sunken p-3 text-sm">
          <h3 className="mb-2 font-semibold text-text-strong">Grand total (admin)</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            <div className="flex justify-between gap-2">
              <dt className="text-text-muted">Inbound fulfillment</dt>
              <dd className="tabular-nums">{money(grand.inboundF)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-text-muted">Outbound fulfillment</dt>
              <dd className="tabular-nums">{money(grand.outboundF)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-text-muted">OMS fulfillment</dt>
              <dd className="tabular-nums">{money(grand.omsF)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-text-muted">OMS EMDAD shipping</dt>
              <dd className="tabular-nums">{money(grand.omsShip)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-text-muted">OMS carrier cost</dt>
              <dd className="tabular-nums">{money(grand.omsCarrier)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-text-muted">Storage</dt>
              <dd className="tabular-nums">{money(grand.storage)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-text-muted">Incentive</dt>
              <dd className="tabular-nums">{money(grand.incentive)}</dd>
            </div>
            <div className="flex justify-between gap-2 font-semibold">
              <dt>Client total</dt>
              <dd className="tabular-nums">{money(grand.clientTotal)}</dd>
            </div>
            <div className="flex justify-between gap-2 font-semibold">
              <dt>EMDAD margin</dt>
              <dd className="tabular-nums">{money(grand.margin)}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </section>
  );
}
