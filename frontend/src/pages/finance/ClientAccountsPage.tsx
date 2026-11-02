import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Alert, Badge, Button, Card, Input, Modal, Skeleton } from '@ds';

import { AdminListPageShell } from '../../components/AdminListPageShell';
import { FinanceNav } from '../../components/finance/FinanceNav';
import { FinanceApi } from '../../api/finance';

export function ClientAccountsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [adjustmentType, setAdjustmentType] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['finance', 'accounts', { search, page }],
    queryFn: () => FinanceApi.listAccounts({ search: search || undefined, page, limit: 25 }),
  });

  const adjustmentMut = useMutation({
    mutationFn: (payload: {
      companyId: string;
      type: 'credit' | 'debit';
      amount: number;
      description: string;
    }) => FinanceApi.createAdjustment(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['finance'] });
      setAdjustmentModalOpen(false);
      setAmount('');
      setDescription('');
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message ?? err.message ?? 'Adjustment failed');
    },
  });

  const handleOpenAdjustment = (companyId?: string) => {
    setSelectedCompanyId(companyId || (data?.items?.[0]?.companyId ?? ''));
    setAdjustmentType('credit');
    setAmount('');
    setDescription('');
    setFormError(null);
    setAdjustmentModalOpen(true);
  };

  const handleSubmitAdjustment = (e: FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      setFormError('Amount must be a positive number');
      return;
    }
    if (!description.trim()) {
      setFormError('Mandatory reason/description is required');
      return;
    }
    adjustmentMut.mutate({
      companyId: selectedCompanyId,
      type: adjustmentType,
      amount: num,
      description: description.trim(),
    });
  };

  return (
    <AdminListPageShell
      icon="Customers"
      title="Client Current Accounts"
      subtitle="Current balance, available balance, pending COD, and account ledger per client"
      showSectionNav={false}
    >
      <FinanceNav
        actions={
          <Button variant="primary" onClick={() => handleOpenAdjustment()}>
            + Manual Adjustment
          </Button>
        }
      />

      <Card padding="md" className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="w-full sm:w-72">
            <Input
              placeholder="Search by client name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <span className="text-xs text-text-muted">
            Showing {data?.items?.length ?? 0} of {data?.total ?? 0} client accounts
          </span>
        </div>
      </Card>

      {error ? (
        <Alert variant="error" className="mb-4">
          Failed to load client accounts.
        </Alert>
      ) : null}

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-subtle bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-text-muted dark:bg-neutral-900/50">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3 text-right">Current Balance</th>
                <th className="px-4 py-3 text-right">Available Balance</th>
                <th className="px-4 py-3 text-right">Pending COD</th>
                <th className="px-4 py-3 text-right">Payout Locked</th>
                <th className="px-4 py-3 text-center">Status</th>
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
                    No client financial accounts found.
                  </td>
                </tr>
              ) : (
                data!.items.map((acc) => (
                  <tr key={acc.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-text-strong">
                        {acc.company?.name ?? acc.companyId}
                      </div>
                      {acc.company?.tradeName ? (
                        <div className="text-xs text-text-muted">{acc.company.tradeName}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-text-strong">
                      ${Number(acc.currentBalance).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      ${Number(acc.availableBalance).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-amber-600 dark:text-amber-400">
                      ${Number(acc.pendingBalance).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-muted">
                      ${Number(acc.payoutLocked).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge tone={acc.status === 'active' ? 'success' : 'warning'}>
                        {acc.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleOpenAdjustment(acc.companyId)}
                        >
                          Adjust
                        </Button>
                        <Link
                          to={`/finance/transactions?companyId=${acc.companyId}`}
                          className="inline-flex h-8 items-center justify-center rounded px-2.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/40"
                        >
                          Statement
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Manual Adjustment Modal */}
      <Modal
        open={adjustmentModalOpen}
        onClose={() => setAdjustmentModalOpen(false)}
        title="Create Manual Financial Adjustment"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAdjustmentModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="adjustment-form"
              variant="primary"
              disabled={adjustmentMut.isPending}
            >
              {adjustmentMut.isPending ? 'Posting...' : 'Post Adjustment'}
            </Button>
          </div>
        }
      >
        <form id="adjustment-form" onSubmit={handleSubmitAdjustment} className="space-y-4">
          {formError ? <Alert variant="error">{formError}</Alert> : null}

          <div>
            <label className="mb-1 block text-xs font-semibold text-text-strong">Client</label>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="w-full rounded border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-strong"
              required
            >
              {(data?.items ?? []).map((acc) => (
                <option key={acc.companyId} value={acc.companyId}>
                  {acc.company?.name ?? acc.companyId} (Avail: ${Number(acc.availableBalance).toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-strong">Type</label>
              <select
                value={adjustmentType}
                onChange={(e) => setAdjustmentType(e.target.value as 'credit' | 'debit')}
                className="w-full rounded border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-strong"
              >
                <option value="credit">Credit (Increase Balance)</option>
                <option value="debit">Debit (Charge Client)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-text-strong">Amount (USD)</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-text-strong">
              Mandatory Reason / Description
            </label>
            <Input
              placeholder="e.g. Compensation for lost item, correction of invoice #123"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
        </form>
      </Modal>
    </AdminListPageShell>
  );
}

export default ClientAccountsPage;
