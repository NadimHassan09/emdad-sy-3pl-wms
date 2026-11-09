import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Alert, Badge, Card, Input, Skeleton } from '@ds';

import { AdminListPageShell } from '../../components/AdminListPageShell';
import { Combobox } from '../../components/Combobox';
import { FinanceNav } from '../../components/finance/FinanceNav';
import { CompaniesApi } from '../../api/companies';
import { FinanceApi } from '../../api/finance';
import { QK } from '../../constants/query-keys';
import { companyFilterComboboxOptions } from '../../lib/company-filter-options';
import { useToast } from '../../components/ToastProvider';

export function FinancialTransactionsPage() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const companyId = searchParams.get('companyId') || '';
  const [type, setType] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [exportingKind, setExportingKind] = useState<'xlsx' | 'csv' | null>(null);

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list({ includeAll: true }),
    staleTime: 10 * 60_000,
  });

  const listParams = useMemo(
    () => ({
      companyId: companyId || undefined,
      type: type || undefined,
      category: category || undefined,
      search: search || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page,
      limit: 25,
    }),
    [companyId, type, category, search, startDate, endDate, page],
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ['finance', 'transactions', listParams],
    queryFn: () => FinanceApi.listTransactions(listParams),
  });

  const setCompanyId = (id: string) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('companyId', id);
    else next.delete('companyId');
    setSearchParams(next);
    setPage(1);
  };

  const downloadExport = async (format: 'xlsx' | 'csv') => {
    if (exportingKind) return;
    setExportingKind(format);
    try {
      const blob = await FinanceApi.exportTransactions({
        companyId: companyId || undefined,
        type: type || undefined,
        category: category || undefined,
        search: search || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        format,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finance-transactions-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(format === 'xlsx' ? 'Excel export downloaded.' : 'CSV export downloaded.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExportingKind(null);
    }
  };

  return (
    <AdminListPageShell
      icon="Reports"
      title="Financial Transactions"
      subtitle="Complete chronological transaction log and audit trail of all financial movements"
      showSectionNav={false}
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-bg-surface px-3 py-2 text-sm font-semibold disabled:opacity-50"
            disabled={!!exportingKind}
            onClick={() => void downloadExport('xlsx')}
          >
            <i
              className={`fa-solid ${exportingKind === 'xlsx' ? 'fa-spinner fa-spin' : 'fa-file-excel'} text-xs text-status-success-fg`}
              aria-hidden
            />
            {exportingKind === 'xlsx' ? 'Exporting…' : 'Export Excel'}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-bg-surface px-3 py-2 text-sm font-semibold disabled:opacity-50"
            disabled={!!exportingKind}
            onClick={() => void downloadExport('csv')}
          >
            <i
              className={`fa-solid ${exportingKind === 'csv' ? 'fa-spinner fa-spin' : 'fa-file-csv'} text-xs`}
              aria-hidden
            />
            {exportingKind === 'csv' ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      }
    >
      <FinanceNav />

      <Card padding="md" className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-muted">Search</label>
            <Input
              placeholder="Search TXN #, description, ref..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <Combobox
              label="Client"
              value={companyId}
              onChange={setCompanyId}
              options={companyFilterComboboxOptions(companies.data, 'All clients')}
              placeholder="All clients"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-text-muted">Type</label>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
              className="w-full rounded border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-strong"
            >
              <option value="">All Types</option>
              <option value="credit">Credit (+)</option>
              <option value="debit">Debit (-)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-text-muted">Category</label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="w-full rounded border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-strong"
            >
              <option value="">All Categories</option>
              <option value="cod_credit">COD Credit</option>
              <option value="shipping_fee">Shipping Fee</option>
              <option value="manual_adjustment">Manual Adjustment</option>
              <option value="payout_disbursement">Payout Disbursement</option>
              <option value="return_fee">Return Fee</option>
              <option value="subscription_fee">Subscription Fee</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-text-muted">From</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-text-muted">To</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-text-muted">Total: {data?.total ?? 0} transactions</span>
        </div>
      </Card>

      {error ? (
        <Alert variant="error" className="mb-4">
          Failed to load financial transactions.
        </Alert>
      ) : null}

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-subtle bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-text-muted dark:bg-neutral-900/50">
              <tr>
                <th className="px-4 py-3">Txn #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3 text-center">Type</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Description</th>
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
                    No transactions found matching your filters.
                  </td>
                </tr>
              ) : (
                data!.items.map((txn) => {
                  const isCredit = txn.type === 'credit';
                  return (
                    <tr key={txn.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-text-strong">
                        {txn.transactionNumber}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-text-muted">
                        {new Date(txn.createdAt).toLocaleDateString()}{' '}
                        {new Date(txn.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 font-medium text-text-strong">
                        {txn.company?.name ?? txn.companyId}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge tone={isCredit ? 'success' : 'danger'}>
                          {isCredit ? '+ Credit' : '- Debit'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-text-muted">
                        {txn.category.replace(/_/g, ' ')}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold tabular-nums ${
                          isCredit
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isCredit ? '+' : '-'}${Number(txn.amount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted">
                        {txn.referenceType ? (
                          <span className="font-mono">
                            {txn.referenceType}: {txn.referenceId?.slice(0, 12)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td
                        className="max-w-xs truncate px-4 py-3 text-xs text-text-strong"
                        title={txn.description}
                      >
                        {txn.description}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {data && data.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-border-subtle px-4 py-3">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded px-3 py-1 text-xs font-semibold text-text-strong hover:bg-neutral-100 disabled:opacity-40 dark:hover:bg-neutral-800"
            >
              Previous
            </button>
            <span className="text-xs text-text-muted">
              Page {page} of {data.totalPages}
            </span>
            <button
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              className="rounded px-3 py-1 text-xs font-semibold text-text-strong hover:bg-neutral-100 disabled:opacity-40 dark:hover:bg-neutral-800"
            >
              Next
            </button>
          </div>
        ) : null}
      </Card>
    </AdminListPageShell>
  );
}

export default FinancialTransactionsPage;
