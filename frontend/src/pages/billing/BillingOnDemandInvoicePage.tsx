import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';

import { BillingApi, type OnDemandInclude, type OnDemandPreview } from '../../api/billing';
import { CompaniesApi } from '../../api/companies';
import { AdminListPageShell } from '../../components/AdminListPageShell';
import { Button } from '../../components/Button';
import { Combobox } from '../../components/Combobox';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';

const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => `${today().slice(0, 8)}01`;
const money = (v: string) => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

const INCLUDE_LABELS: Array<[keyof OnDemandInclude, string]> = [
  ['inbound', 'Inbound orders'],
  ['outbound', 'Outbound orders'],
  ['oms', 'Online (OMS) orders'],
  ['shipping', 'Shipping fees'],
  ['storage', 'Storage'],
];

export function BillingOnDemandInvoicePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [companyId, setCompanyId] = useState('');
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [include, setInclude] = useState<OnDemandInclude>({ inbound: true, outbound: true, oms: true, storage: true, shipping: true });
  const [preview, setPreview] = useState<OnDemandPreview | null>(null);

  const companies = useQuery({ queryKey: QK.companies, queryFn: () => CompaniesApi.list({ includeAll: true }) });
  const input = { companyId, from, to, include };

  const run = useMutation({
    mutationFn: () => BillingApi.previewOnDemand(input),
    onSuccess: setPreview,
    onError: (err: Error) => {
      setPreview(null);
      toast.error(err.message);
    },
  });
  const create = useMutation({
    mutationFn: () => BillingApi.createOnDemand(input),
    onSuccess: (r) => {
      toast.success('Draft invoice created. Review it, then issue it.');
      navigate(`/billing/invoices/${r.invoice.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const invalidDates = !from || !to || to < from;
  const charged = preview?.items.filter((i) => i.charged) ?? [];

  return (
    <AdminListPageShell
      icon="fa-file-invoice"
      title="On-demand invoice"
      subtitle="Invoice a client for any period, today or mid-month. Nothing here waits for a billing cycle."
    >
      <div className="space-y-4 rounded-xl border border-border bg-surface-card p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Combobox
            label="Client"
            value={companyId}
            onChange={(v) => {
              setCompanyId(v);
              setPreview(null);
            }}
            options={(companies.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Select client"
          />
          <TextField label="From" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreview(null); }} />
          <TextField label="To" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreview(null); }} />
        </div>
        <div className="flex flex-wrap gap-4">
          {INCLUDE_LABELS.map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={include[key]}
                onChange={(e) => {
                  setInclude((p) => ({ ...p, [key]: e.target.checked }));
                  setPreview(null);
                }}
              />
              {label}
            </label>
          ))}
        </div>
        <p className="text-xs text-text-muted">
          Only items enabled in the client&apos;s <Link className="underline" to="/billing/charge-rules">charge rules</Link> are charged.
          Orders already on another invoice are skipped.
        </p>
        {invalidDates ? <p className="text-sm text-status-error-fg">The end date must not be before the start date.</p> : null}
        <Button type="button" disabled={!companyId || invalidDates} loading={run.isPending} onClick={() => run.mutate()}>
          Preview
        </Button>
      </div>

      {preview ? (
        <div className="space-y-4 rounded-xl border border-border bg-surface-card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-text-strong">
              {preview.company.name} · {preview.period.from} to {preview.period.to} ({preview.period.days} days)
            </h2>
            <p className="text-lg font-semibold text-text-strong">Total {money(preview.totals.total)}</p>
          </div>
          {preview.warnings.map((w) => (
            <p key={w} className="rounded-lg bg-status-warning-bg px-3 py-2 text-sm text-status-warning-fg">{w}</p>
          ))}
          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
            {[
              ['Inbound fulfillment', preview.totals.inboundFulfillment],
              ['Outbound fulfillment', preview.totals.outboundFulfillment],
              ['OMS fulfillment', preview.totals.omsFulfillment],
              ['Shipping fees', preview.totals.emdadShipping],
              ['Storage', preview.totals.storage],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-surface-sunken p-3">
                <p className="text-xs text-text-muted">{label}</p>
                <p className="font-semibold">{money(value)}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-text-muted">
            {charged.length} order(s) charged, {preview.items.length - charged.length} listed for information only.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-text-muted">
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Lines</th>
                  <th className="px-3 py-2 text-right">kg</th>
                  <th className="px-3 py-2 text-right">Fulfillment</th>
                  <th className="px-3 py-2 text-right">Shipping</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.map((i) => (
                  <tr key={`${i.orderKind}-${i.orderId}`} className={`border-b border-border/60 ${i.charged ? '' : 'text-text-muted'}`}>
                    <td className="px-3 py-2">{i.orderKind}</td>
                    <td className="px-3 py-2 font-mono">{i.orderNumber}</td>
                    <td className="px-3 py-2">{i.orderStatus.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2 text-right">{i.linesCount}</td>
                    <td className="px-3 py-2 text-right">{Number(i.weightKg).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{i.charged ? money(i.fulfillmentFee) : '—'}</td>
                    <td className="px-3 py-2 text-right">
                      {i.charged && Number(i.shippingFee) > 0 ? (i.shippingFeeAlreadySettled ? `${money(i.shippingFee)} (already deducted)` : money(i.shippingFee)) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button type="button" loading={create.isPending} disabled={Number(preview.totals.total) <= 0 && charged.length === 0} onClick={() => create.mutate()}>
            Create draft invoice
          </Button>
        </div>
      ) : null}
    </AdminListPageShell>
  );
}
