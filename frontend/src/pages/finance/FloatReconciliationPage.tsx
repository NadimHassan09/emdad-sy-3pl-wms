import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Badge, Button, Card, Input, Skeleton } from '@ds';

import { AdminListPageShell } from '../../components/AdminListPageShell';
import { FinanceNav } from '../../components/finance/FinanceNav';
import { FinanceApi } from '../../api/finance';

type ReconStatus = 'match' | 'amount_mismatch' | 'missing_in_emdad' | 'duplicate_in_emdad';

function statusBadge(status: ReconStatus) {
  const map: Record<ReconStatus, { tone: 'success' | 'warning' | 'danger' | 'neutral'; label: string }> = {
    match: { tone: 'success', label: 'Match' },
    amount_mismatch: { tone: 'warning', label: 'Amount mismatch' },
    missing_in_emdad: { tone: 'danger', label: 'Missing in EMDAD' },
    duplicate_in_emdad: { tone: 'danger', label: 'Duplicate in EMDAD' },
  };
  const m = map[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function FloatReconciliationPage() {
  const [providerCode, setProviderCode] = useState('');
  const [alertLimitUsd, setAlertLimitUsd] = useState('5000');
  const [paste, setPaste] = useState('');

  const floatQ = useQuery({
    queryKey: ['finance', 'float', 'in-transit', providerCode, alertLimitUsd],
    queryFn: () =>
      FinanceApi.getInTransitFloat({
        providerCode: providerCode || undefined,
        alertLimitUsd: alertLimitUsd ? Number(alertLimitUsd) : undefined,
      }),
  });

  const reconMut = useMutation({
    mutationFn: () => {
      const rows = paste
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const parts = line.split(/[\t,;]+/).map((p) => p.trim());
          return {
            awb: parts[0] || '',
            amount: Number(parts[1] || 0),
            currency: parts[2] || 'USD',
          };
        })
        .filter((r) => r.awb);
      return FinanceApi.reconcileCarrierStatement({
        providerCode: providerCode || undefined,
        rows,
      });
    },
  });

  const floatEnabled = floatQ.data?.enabled === true;
  const totals = floatQ.data?.totalsByCurrency ?? [];

  const pasteHint = useMemo(
    () => 'One row per line: AWB, amount, currency (optional). Tab/comma/semicolon separated.',
    [],
  );

  return (
    <AdminListPageShell
      icon="Reports"
      title="Float & Carrier Reconciliation"
      subtitle="B12 — In-transit carrier cost float and statement vs EMDAD shipment matching"
      showSectionNav={false}
    >
      <FinanceNav />

      <Card padding="md" className="mb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-muted">Provider code</label>
            <Input
              placeholder="babel / sila / sena…"
              value={providerCode}
              onChange={(e) => setProviderCode(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-muted">Float alert limit (USD)</label>
            <Input
              value={alertLimitUsd}
              onChange={(e) => setAlertLimitUsd(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button variant="secondary" onClick={() => void floatQ.refetch()}>
              Refresh float
            </Button>
          </div>
        </div>
      </Card>

      {floatQ.isLoading ? (
        <Skeleton className="mb-4 h-28" />
      ) : floatQ.error ? (
        <Alert variant="error" className="mb-4">
          Failed to load in-transit float.
        </Alert>
      ) : !floatEnabled ? (
        <Alert variant="warning" className="mb-4">
          In-transit float is disabled. Enable <strong>In-transit float</strong> under Finance → Policies.
        </Alert>
      ) : (
        <div className="mb-6 space-y-3">
          {floatQ.data?.alert ? (
            <Alert variant="warning">{floatQ.data.alert.message}</Alert>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3">
            {totals.length === 0 ? (
              <Card padding="md">
                <p className="text-sm text-text-muted">No unpaid in-transit carrier costs.</p>
              </Card>
            ) : (
              totals.map((t) => (
                <Card key={t.currency} padding="md">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    Float ({t.currency})
                  </p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-amber-600">
                    {Number(t.amount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">{t.shipmentCount} shipments</p>
                </Card>
              ))
            )}
          </div>
          {(floatQ.data?.items?.length ?? 0) > 0 ? (
            <Card padding="md" className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-text-muted">
                    <th className="py-2 pr-3">AWB</th>
                    <th className="py-2 pr-3">Order</th>
                    <th className="py-2 pr-3">Provider</th>
                    <th className="py-2 pr-3">Tracking</th>
                    <th className="py-2 pr-3 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {floatQ.data!.items.slice(0, 100).map((row) => (
                    <tr key={row.id} className="border-b border-border-subtle">
                      <td className="py-2 pr-3 font-mono text-xs">{row.externalAwb ?? '—'}</td>
                      <td className="py-2 pr-3">{row.outboundOrderNumber ?? '—'}</td>
                      <td className="py-2 pr-3">{row.providerCode}</td>
                      <td className="py-2 pr-3">{row.lastTrackingStatus ?? '—'}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {row.shippingCost} {row.currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ) : null}
        </div>
      )}

      <Card padding="md" className="space-y-3">
        <h3 className="font-semibold text-text-strong">Carrier statement reconciliation</h3>
        <p className="text-xs text-text-muted">{pasteHint}</p>
        <textarea
          className="min-h-[140px] w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs"
          placeholder={'AWB123\t12.50\tUSD\nAWB456,9.00,SYP'}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            disabled={!paste.trim() || reconMut.isPending}
            onClick={() => reconMut.mutate()}
          >
            {reconMut.isPending ? 'Reconciling…' : 'Run reconciliation'}
          </Button>
          {reconMut.isError ? (
            <span className="text-sm text-danger">
              {(reconMut.error as any)?.response?.data?.message ??
                (reconMut.error as Error).message ??
                'Reconciliation failed (enable the policy flag if disabled).'}
            </span>
          ) : null}
        </div>

        {reconMut.data ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge tone="neutral">Rows: {reconMut.data.summary.statementRows}</Badge>
              <Badge tone="success">Match: {reconMut.data.summary.match}</Badge>
              <Badge tone="warning">Mismatch: {reconMut.data.summary.amountMismatch}</Badge>
              <Badge tone="danger">Missing: {reconMut.data.summary.missingInEmdad}</Badge>
              <Badge tone="danger">Dup: {reconMut.data.summary.duplicateInEmdad}</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-text-muted">
                    <th className="py-2 pr-3">AWB</th>
                    <th className="py-2 pr-3">Statement</th>
                    <th className="py-2 pr-3">EMDAD</th>
                    <th className="py-2 pr-3">Order</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reconMut.data.matches.map((m) => (
                    <tr key={`${m.awb}-${m.statementAmount}`} className="border-b border-border-subtle">
                      <td className="py-2 pr-3 font-mono text-xs">{m.awb}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        {m.statementAmount} {m.statementCurrency}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {m.emdadAmount ?? '—'} {m.emdadCurrency ?? ''}
                      </td>
                      <td className="py-2 pr-3">{m.outboundOrderNumber ?? '—'}</td>
                      <td className="py-2 pr-3">{statusBadge(m.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Card>
    </AdminListPageShell>
  );
}

export default FloatReconciliationPage;
