import { useQuery } from '@tanstack/react-query';

import { BillingApi } from '../../api/billing';
import { QK } from '../../constants/query-keys';
import { formatDecimal, humanizeInvoiceStatus, invoiceStatusClass } from '../../lib/billing-invoice-display';

export function BillingInvoicePreviewCard({ companyId }: { companyId: string }) {
  const query = useQuery({
    queryKey: [...QK.billing.preview, companyId],
    queryFn: () => BillingApi.getCyclePreview(companyId),
    enabled: !!companyId,
  });

  const data = query.data;
  const preview = data?.preview;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Current cycle preview</h3>
      <p className="mt-1 text-xs text-slate-500">
        Live draft totals — not a finalized invoice. Updates when operations complete.
      </p>

      {query.isPending ? <p className="mt-4 text-sm text-slate-500">Loading preview…</p> : null}
      {query.isError ? <p className="mt-4 text-sm text-rose-600">Could not load preview.</p> : null}

      {data ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Days remaining</dt>
            <dd className="text-sm font-semibold">{data.cycle.daysRemaining}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Used / allocated CBM</dt>
            <dd className="text-sm font-semibold">
              {formatDecimal(data.usage.usedVolumeCbm, 2)} / {formatDecimal(data.usage.allocatedVolumeCbm, 2)}
            </dd>
          </div>
        </dl>
      ) : null}

      {preview ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm">{preview.invoiceNumber}</span>
            <span className={invoiceStatusClass(preview.status)}>{humanizeInvoiceStatus(preview.status)}</span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{formatDecimal(preview.grandTotal)}</p>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {preview.lines.map((line) => (
              <li key={line.id} className="flex justify-between py-1.5">
                <span className="text-slate-600">{line.type.replace(/_/g, ' ')}</span>
                <span className="font-mono tabular-nums">{formatDecimal(line.totalPrice)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">No draft invoice for the current cycle.</p>
      )}
    </section>
  );
}
