import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Button, Card, Input, Modal, Skeleton } from '@ds';

import { AdminListPageShell } from '../../components/AdminListPageShell';
import { FinanceNav } from '../../components/finance/FinanceNav';
import { FinanceApi, type CodFinancialRow } from '../../api/finance';

export function CodFinancialPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  // Modals for manual collection / remittance confirmation
  const [collectModalRecord, setCollectModalRecord] = useState<CodFinancialRow | null>(null);
  const [remitModalRecord, setRemitModalRecord] = useState<CodFinancialRow | null>(null);
  const [remittanceRef, setRemittanceRef] = useState('');
  const [notes, setNotes] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['finance', 'cod', { search, status, page }],
    queryFn: () => FinanceApi.listCod({ search: search || undefined, status: status || undefined, page, limit: 25 }),
  });

  const confirmCollectMut = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      FinanceApi.confirmCodCollection(id, { notes }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['finance'] });
      setCollectModalRecord(null);
      setNotes('');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message ?? err.message ?? 'Confirmation failed');
    },
  });

  const confirmRemitMut = useMutation({
    mutationFn: ({ id, ref, notes }: { id: string; ref?: string; notes?: string }) =>
      FinanceApi.confirmCodRemittance(id, { remittanceReference: ref, notes }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['finance'] });
      setRemitModalRecord(null);
      setRemittanceRef('');
      setNotes('');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message ?? err.message ?? 'Remittance confirmation failed');
    },
  });

  return (
    <AdminListPageShell
      icon="Orders"
      title="COD Financial Management"
      subtitle="Track expected COD, carrier collection verification, remittance to EMDAD, and account credits"
      showSectionNav={false}
    >
      <FinanceNav />

      {/* Info Callout */}
      <Alert variant="info" className="mb-4">
        <strong>Business Rule:</strong> Delivered status does not automatically mean EMDAD has received the cash.
        COD remains pending/held until collection or carrier remittance is verified.
      </Alert>

      {/* Filter Toolbar */}
      <Card padding="md" className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-64">
              <Input
                placeholder="Search order #, tracking #, ref..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="rounded border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-strong"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending (Held)</option>
              <option value="available">Available (Credited)</option>
              <option value="paid_out">Paid Out</option>
              <option value="returned">Returned</option>
            </select>
          </div>
          <span className="text-xs text-text-muted">
            Showing {data?.items?.length ?? 0} of {data?.total ?? 0} COD records
          </span>
        </div>
      </Card>

      {error ? (
        <Alert variant="error" className="mb-4">
          Failed to load COD records.
        </Alert>
      ) : null}

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-subtle bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-text-muted dark:bg-neutral-900/50">
              <tr>
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3 text-right">COD Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3">Carrier Collection</th>
                <th className="px-4 py-3">Carrier Remittance</th>
                <th className="px-4 py-3 text-center">Client Account</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center">
                    <Skeleton className="h-6 w-full" />
                  </td>
                </tr>
              ) : (data?.items ?? []).length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-text-muted">
                    No COD records found matching criteria.
                  </td>
                </tr>
              ) : (
                data!.items.map((row) => (
                  <tr key={row.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-semibold text-text-strong">
                        {row.omsOrder?.orderNumber ?? row.omsOrderId.slice(0, 8)}
                      </div>
                      {row.omsOrder?.trackingNumber ? (
                        <div className="text-[11px] text-text-muted">
                          AWB: {row.omsOrder.trackingNumber} ({row.omsOrder.shippingProviderCode ?? 'Carrier'})
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-medium text-text-strong">
                      {row.company?.name ?? row.companyId}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-text-strong">
                      ${Number(row.currentAmount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        tone={
                          row.status === 'available'
                            ? 'success'
                            : row.status === 'pending'
                              ? 'warning'
                              : row.status === 'returned'
                                ? 'danger'
                                : 'neutral'
                        }
                      >
                        {row.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {row.carrierCollectedAt ? (
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          ✓ Confirmed ({new Date(row.carrierCollectedAt).toLocaleDateString()})
                        </span>
                      ) : (
                        <span className="text-text-muted">Pending confirmation</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {row.carrierRemittedAt ? (
                        <div className="font-medium text-emerald-600 dark:text-emerald-400">
                          ✓ Remitted ({new Date(row.carrierRemittedAt).toLocaleDateString()})
                          {row.remittanceReference ? (
                            <div className="font-mono text-[10px] text-text-muted">
                              Ref: {row.remittanceReference}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-text-muted">Pending remittance</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-xs">
                      {row.creditedToAccountAt ? (
                        <Badge tone="success">Credited Available</Badge>
                      ) : (
                        <Badge tone="warning">Held in Pending</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!row.carrierCollectedAt ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setActionError(null);
                              setCollectModalRecord(row);
                            }}
                          >
                            Confirm Collect
                          </Button>
                        ) : null}

                        {!row.carrierRemittedAt ? (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              setActionError(null);
                              setRemittanceRef('');
                              setRemitModalRecord(row);
                            }}
                          >
                            Confirm Remit
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-border-subtle px-4 py-3">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded px-3 py-1 text-xs font-semibold text-text-strong hover:bg-neutral-100 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-text-muted">
              Page {page} of {data.totalPages}
            </span>
            <button
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              className="rounded px-3 py-1 text-xs font-semibold text-text-strong hover:bg-neutral-100 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
      </Card>

      {/* Confirm Collection Modal */}
      <Modal
        open={Boolean(collectModalRecord)}
        onClose={() => setCollectModalRecord(null)}
        title="Confirm Carrier Collection"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setCollectModalRecord(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={confirmCollectMut.isPending}
              onClick={() => {
                if (collectModalRecord) {
                  confirmCollectMut.mutate({ id: collectModalRecord.id, notes });
                }
              }}
            >
              {confirmCollectMut.isPending ? 'Confirming...' : 'Confirm Collection'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {actionError ? <Alert variant="error">{actionError}</Alert> : null}
          <p className="text-sm text-text-strong">
            Confirm that the carrier has collected <strong>${collectModalRecord?.currentAmount}</strong> from the recipient for order{' '}
            <span className="font-mono">{collectModalRecord?.omsOrder?.orderNumber}</span>.
          </p>
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-strong">Notes (optional)</label>
            <Input
              placeholder="e.g. Verified via carrier daily delivery report"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* Confirm Remittance Modal */}
      <Modal
        open={Boolean(remitModalRecord)}
        onClose={() => setRemitModalRecord(null)}
        title="Confirm Carrier Cash Remittance"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setRemitModalRecord(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={confirmRemitMut.isPending}
              onClick={() => {
                if (remitModalRecord) {
                  confirmRemitMut.mutate({
                    id: remitModalRecord.id,
                    ref: remittanceRef.trim() || undefined,
                    notes,
                  });
                }
              }}
            >
              {confirmRemitMut.isPending ? 'Confirming...' : 'Confirm Remittance & Credit Client'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {actionError ? <Alert variant="error">{actionError}</Alert> : null}
          <p className="text-sm text-text-strong">
            Confirm that EMDAD has received cash remittance of{' '}
            <strong>${remitModalRecord?.currentAmount}</strong> from the carrier for order{' '}
            <span className="font-mono">{remitModalRecord?.omsOrder?.orderNumber}</span>.
          </p>
          <p className="text-xs text-text-muted">
            This will automatically credit the client&apos;s available account balance and record the financial transaction.
          </p>
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-strong">
              Remittance Reference / Carrier Receipt #
            </label>
            <Input
              placeholder="e.g. REMIT-2026-11-BABEL-049"
              value={remittanceRef}
              onChange={(e) => setRemittanceRef(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-strong">Notes (optional)</label>
            <Input
              placeholder="e.g. Bank deposit reference or cash handover sheet"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </AdminListPageShell>
  );
}

export default CodFinancialPage;
