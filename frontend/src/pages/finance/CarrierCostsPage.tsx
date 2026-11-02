import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Button, Card, Input, Modal, Skeleton } from '@ds';

import { AdminListPageShell } from '../../components/AdminListPageShell';
import { FinanceNav } from '../../components/finance/FinanceNav';
import { FinanceApi, type CarrierCostRow } from '../../api/finance';

export function CarrierCostsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [providerCode, setProviderCode] = useState('');
  const [paidStatus, setPaidStatus] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [page, setPage] = useState(1);

  // Mark Paid Modal
  const [payRecord, setPayRecord] = useState<CarrierCostRow | null>(null);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['finance', 'carrier-costs', { search, providerCode, paidStatus, page }],
    queryFn: () =>
      FinanceApi.listCarrierCosts({
        search: search || undefined,
        providerCode: providerCode || undefined,
        paidStatus,
        page,
        limit: 25,
      }),
  });

  const markPaidMut = useMutation({
    mutationFn: ({ id, ref, notes }: { id: string; ref?: string; notes?: string }) =>
      FinanceApi.markCarrierCostPaid(id, { reference: ref, notes }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['finance', 'carrier-costs'] });
      setPayRecord(null);
      setReference('');
      setNotes('');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message ?? err.message ?? 'Mark paid failed');
    },
  });

  return (
    <AdminListPageShell
      icon="Orders"
      title="Carrier Internal Costs"
      subtitle="Track carrier payables, provider invoices, confirmed costs, and carrier payments (Internal Only)"
      showSectionNav={false}
    >
      <FinanceNav />

      {/* Internal confidentiality callout */}
      <Alert variant="warning" className="mb-4">
        <strong>Confidential:</strong> Carrier shipping costs and provider margins are internal to EMDAD and are never exposed to clients.
      </Alert>

      {/* Filters */}
      <Card padding="md" className="mb-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-muted">Search</label>
            <Input
              placeholder="Search AWB, order #, tracking..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-text-muted">Provider</label>
            <select
              value={providerCode}
              onChange={(e) => {
                setProviderCode(e.target.value);
                setPage(1);
              }}
              className="w-full rounded border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-strong"
            >
              <option value="">All Providers</option>
              <option value="babel_express">Babel Express</option>
              <option value="sila_sy">Sila</option>
              <option value="sena_express">Sena Express</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-text-muted">Payment Status</label>
            <select
              value={paidStatus}
              onChange={(e) => {
                setPaidStatus(e.target.value as any);
                setPage(1);
              }}
              className="w-full rounded border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-strong"
            >
              <option value="all">All</option>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          <div className="flex items-end justify-end">
            <span className="text-xs text-text-muted">
              Total: {data?.total ?? 0} shipments
            </span>
          </div>
        </div>
      </Card>

      {error ? (
        <Alert variant="error" className="mb-4">
          Failed to load carrier costs.
        </Alert>
      ) : null}

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-subtle bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-text-muted dark:bg-neutral-900/50">
              <tr>
                <th className="px-4 py-3">Carrier / Provider</th>
                <th className="px-4 py-3">Shipment / AWB</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3 text-right">Carrier Cost</th>
                <th className="px-4 py-3">Cost Source</th>
                <th className="px-4 py-3 text-center">Paid Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center">
                    <Skeleton className="h-6 w-full" />
                  </td>
                </tr>
              ) : (data?.items ?? []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-text-muted">
                    No carrier shipments found.
                  </td>
                </tr>
              ) : (
                data!.items.map((row) => (
                  <tr key={row.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-text-strong">{row.providerName}</div>
                      <div className="font-mono text-xs text-text-muted">{row.providerCode}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-semibold text-text-strong">
                        AWB: {row.externalAwb ?? row.trackingNumber ?? '—'}
                      </div>
                      <div className="text-xs text-text-muted">
                        Outbound: {row.outboundOrderNumber ?? row.outboundOrderId.slice(0, 8)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-strong">
                      {row.clientName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-text-strong">
                      {row.shippingCost ? `$${Number(row.shippingCost).toFixed(2)}` : 'Pending Quote'}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">
                      {row.shippingCostSource ?? 'api_estimate'}
                      {row.shippingCostEventAt ? (
                        <div className="text-[10px]">{new Date(row.shippingCostEventAt).toLocaleDateString()}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.costPaidAt ? (
                        <div>
                          <Badge tone="success">Paid</Badge>
                          <div className="text-[10px] text-text-muted">{new Date(row.costPaidAt).toLocaleDateString()}</div>
                        </div>
                      ) : (
                        <Badge tone="warning">Unpaid</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!row.costPaidAt ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setActionError(null);
                            setReference('');
                            setPayRecord(row);
                          }}
                        >
                          Mark Paid
                        </Button>
                      ) : (
                        <span className="font-mono text-xs text-text-muted">{row.costPaidReference ?? '✓ Settled'}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mark Carrier Cost Paid Modal */}
      <Modal
        open={Boolean(payRecord)}
        onClose={() => setPayRecord(null)}
        title="Record Carrier Invoice / Cost Payment"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setPayRecord(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={markPaidMut.isPending}
              onClick={() => {
                if (payRecord) {
                  markPaidMut.mutate({
                    id: payRecord.id,
                    ref: reference.trim() || undefined,
                    notes: notes.trim() || undefined,
                  });
                }
              }}
            >
              {markPaidMut.isPending ? 'Saving...' : 'Confirm Paid to Carrier'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {actionError ? <Alert variant="error">{actionError}</Alert> : null}
          <p className="text-sm text-text-strong">
            Record that EMDAD has paid carrier <strong>{payRecord?.providerName}</strong> for shipment AWB{' '}
            <span className="font-mono">{payRecord?.externalAwb ?? payRecord?.trackingNumber}</span> ({payRecord?.shippingCost ? `$${payRecord.shippingCost}` : 'Cost'}).
          </p>
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-strong">
              Payment Reference / Carrier Invoice #
            </label>
            <Input
              placeholder="e.g. BABEL-INV-OCT-0941"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-strong">Notes</label>
            <Input
              placeholder="e.g. Paid via bank transfer"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </AdminListPageShell>
  );
}

export default CarrierCostsPage;
