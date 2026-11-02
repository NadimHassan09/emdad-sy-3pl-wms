import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Button, Card, Input, Modal, Skeleton } from '@ds';

import { AdminListPageShell } from '../../components/AdminListPageShell';
import { FinanceNav } from '../../components/finance/FinanceNav';
import { FinanceApi, type ClientPayoutRow } from '../../api/finance';

export function PayoutManagementPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  // Modals
  const [rejectRecord, setRejectRecord] = useState<ClientPayoutRow | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [payRecord, setPayRecord] = useState<ClientPayoutRow | null>(null);
  const [payoutRef, setPayoutRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['finance', 'payouts', { status, page }],
    queryFn: () => FinanceApi.listPayouts({ status: status || undefined, page, limit: 25 }),
  });

  const reviewMut = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: 'approved' | 'rejected'; reason?: string }) =>
      FinanceApi.reviewPayout(id, { status, rejectionReason: reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['finance'] });
      setRejectRecord(null);
      setRejectionReason('');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message ?? err.message ?? 'Review action failed');
    },
  });

  const recordPaidMut = useMutation({
    mutationFn: ({ id, ref, notes }: { id: string; ref?: string; notes?: string }) =>
      FinanceApi.recordPayoutPaid(id, { payoutReference: ref, notes }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['finance'] });
      setPayRecord(null);
      setPayoutRef('');
      setPayNotes('');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message ?? err.message ?? 'Record paid failed');
    },
  });

  return (
    <AdminListPageShell
      icon="Reports"
      title="Client Payout Management"
      subtitle="Review client withdrawal requests, approve disbursements, and record bank transfer executions"
      showSectionNav={false}
    >
      <FinanceNav />

      {/* Filter toolbar */}
      <Card padding="md" className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-text-muted">Status</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="rounded border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-strong"
            >
              <option value="">All Statuses</option>
              <option value="requested">Requested (Pending Review)</option>
              <option value="approved">Approved (Awaiting Transfer)</option>
              <option value="paid">Paid (Completed)</option>
              <option value="rejected">Rejected (Released)</option>
            </select>
          </div>
          <span className="text-xs text-text-muted">
            Total: {data?.total ?? 0} requests
          </span>
        </div>
      </Card>

      {error ? (
        <Alert variant="error" className="mb-4">
          Failed to load payouts.
        </Alert>
      ) : null}

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-subtle bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-text-muted dark:bg-neutral-900/50">
              <tr>
                <th className="px-4 py-3">Payout #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3">Bank Details</th>
                <th className="px-4 py-3">Reference</th>
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
                    No payout requests found.
                  </td>
                </tr>
              ) : (
                data!.items.map((row) => (
                  <tr key={row.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-text-strong">
                      {row.payoutNumber}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-text-muted">
                      {new Date(row.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-text-strong">
                      {row.company?.name ?? row.companyId}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-text-strong">
                      ${Number(row.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        tone={
                          row.status === 'paid'
                            ? 'success'
                            : row.status === 'approved'
                              ? 'brand'
                              : row.status === 'rejected'
                                ? 'danger'
                                : 'warning'
                        }
                      >
                        {row.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">
                      {row.bankName ? (
                        <div>
                          <span className="font-semibold text-text-strong">{row.bankName}</span>
                          {row.accountNumber ? <span> · Acc: {row.accountNumber}</span> : null}
                          {row.iban ? <div className="font-mono text-[10px]">IBAN: {row.iban}</div> : null}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">
                      {row.payoutReference ? (
                        <span className="font-mono">{row.payoutReference}</span>
                      ) : row.rejectionReason ? (
                        <span className="text-rose-600">{row.rejectionReason}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {row.status === 'requested' ? (
                          <>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => reviewMut.mutate({ id: row.id, status: 'approved' })}
                              disabled={reviewMut.isPending}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => {
                                setActionError(null);
                                setRejectionReason('');
                                setRejectRecord(row);
                              }}
                            >
                              Reject
                            </Button>
                          </>
                        ) : null}

                        {row.status === 'approved' || row.status === 'requested' ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setActionError(null);
                              setPayoutRef('');
                              setPayNotes('');
                              setPayRecord(row);
                            }}
                          >
                            Record Paid
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
      </Card>

      {/* Reject Modal */}
      <Modal
        open={Boolean(rejectRecord)}
        onClose={() => setRejectRecord(null)}
        title="Reject Payout Request"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejectRecord(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={reviewMut.isPending}
              onClick={() => {
                if (rejectRecord) {
                  reviewMut.mutate({
                    id: rejectRecord.id,
                    status: 'rejected',
                    reason: rejectionReason.trim() || 'Rejected by administrator',
                  });
                }
              }}
            >
              {reviewMut.isPending ? 'Rejecting...' : 'Confirm Reject & Unlock Funds'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {actionError ? <Alert variant="error">{actionError}</Alert> : null}
          <p className="text-sm text-text-strong">
            Rejecting payout <strong>{rejectRecord?.payoutNumber}</strong> for ${rejectRecord?.amount} will automatically release the reserved funds back to the client&apos;s available balance.
          </p>
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-strong">
              Rejection Reason
            </label>
            <Input
              placeholder="e.g. Invalid bank IBAN, pending dispute"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              required
            />
          </div>
        </div>
      </Modal>

      {/* Record Paid Modal */}
      <Modal
        open={Boolean(payRecord)}
        onClose={() => setPayRecord(null)}
        title="Record Payout Execution"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setPayRecord(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={recordPaidMut.isPending}
              onClick={() => {
                if (payRecord) {
                  recordPaidMut.mutate({
                    id: payRecord.id,
                    ref: payoutRef.trim() || undefined,
                    notes: payNotes.trim() || undefined,
                  });
                }
              }}
            >
              {recordPaidMut.isPending ? 'Executing...' : 'Confirm Paid'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {actionError ? <Alert variant="error">{actionError}</Alert> : null}
          <p className="text-sm text-text-strong">
            Confirm execution of bank transfer for payout <strong>{payRecord?.payoutNumber}</strong> in the amount of <strong>${payRecord?.amount}</strong>.
          </p>
          <p className="text-xs text-text-muted">
            This will mark the payout as paid, post a debit disbursement transaction to the client&apos;s account, and finalize the deduction.
          </p>
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-strong">
              Bank Transfer Reference / Transaction ID
            </label>
            <Input
              placeholder="e.g. WIRE-2026-99214 or Check #1044"
              value={payoutRef}
              onChange={(e) => setPayoutRef(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-strong">Payment Notes (optional)</label>
            <Input
              placeholder="e.g. Sent via Commercial Bank of Syria"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </AdminListPageShell>
  );
}

export default PayoutManagementPage;
