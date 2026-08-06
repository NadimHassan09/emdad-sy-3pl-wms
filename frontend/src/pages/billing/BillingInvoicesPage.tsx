import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { BillingApi, type BillingInvoiceRow } from '../../api/billing';
import { CompaniesApi } from '../../api/companies';
import { AdminListPageShell } from '../../components/AdminListPageShell';
import { AnchoredDropdown } from '../../components/AnchoredDropdown';
import { Combobox } from '../../components/Combobox';
import { DataTable, type Column } from '../../components/DataTable';
import { FilterPanel } from '../../components/FilterPanel';
import { SelectField } from '../../components/SelectField';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { useAuth } from '../../auth/AuthContext';
import { QK } from '../../constants/query-keys';
import { useFilters } from '../../hooks/useFilters';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../../hooks/useChunkedServerPagination';
import { companyFilterComboboxOptions } from '../../lib/company-filter-options';
import {
  formatCycleLabel,
  formatDate,
  formatDecimal,
  humanizeInvoiceStatus,
  invoiceStatusClass,
  type InvoiceStatusFilter,
} from '../../lib/billing-invoice-display';

const CURRENCY = 'USD';

type ListFilters = {
  companyId: string;
  search: string;
  status: InvoiceStatusFilter;
  createdFrom: string;
  createdTo: string;
  sort_by: 'createdAt' | 'invoiceNumber' | 'totalAmount' | 'status' | 'issuedAt';
  sort_dir: 'asc' | 'desc';
};

const INITIAL_FILTERS: ListFilters = {
  companyId: '',
  search: '',
  status: '',
  createdFrom: '',
  createdTo: '',
  sort_by: 'createdAt',
  sort_dir: 'desc',
};

export function BillingInvoicesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const canMutate = user?.role === 'super_admin' || user?.role === 'wh_manager';
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters<ListFilters>(INITIAL_FILTERS);

  useEffect(() => {
    if (!openActionId) return;
    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target as Element | null;
      if (!target) return;
      if (
        target.closest('[data-billing-action-trigger="true"]') ||
        target.closest('[data-billing-action-menu="true"]') ||
        target.closest('[data-billing-action-menu-button="true"]')
      ) {
        return;
      }
      setOpenActionId(null);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [openActionId]);

  const companiesQuery = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list({ includeAll: true }),
  });

  const serverFilters = useMemo(
    () => ({
      companyId: appliedFilters.companyId.trim() || undefined,
      search: appliedFilters.search.trim() || undefined,
      status: appliedFilters.status || undefined,
      createdFrom: appliedFilters.createdFrom || undefined,
      createdTo: appliedFilters.createdTo || undefined,
      sort_by: appliedFilters.sort_by,
      sort_dir: appliedFilters.sort_dir,
    }),
    [appliedFilters],
  );

  const pagination = useChunkedServerPagination<BillingInvoiceRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: serverFilters,
    fetchChunk: (offset, limit) =>
      BillingApi.listInvoicesPage({ ...serverFilters, offset, limit }),
    rtQueryKeyPrefix: QK.billing.invoices,
    chunkQueryKeyPrefix: 'billing-invoices-chunk',
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: QK.billing.invoices });
    void qc.invalidateQueries({ queryKey: QK.billing.dashboardSummary });
  };

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'paid' | 'cancelled' | 'unpaid' }) =>
      BillingApi.updateInvoiceStatus(id, status),
    onSuccess: () => {
      toast.success('Invoice status updated.');
      setOpenActionId(null);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => BillingApi.deleteInvoice(id),
    onSuccess: () => {
      toast.success('Invoice deleted.');
      setOpenActionId(null);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const columns: Column<BillingInvoiceRow>[] = [
    {
      header: 'Invoice number',
      accessor: (r) => (
        <span className="font-mono text-sm font-semibold text-brand-700">{r.invoiceNumber}</span>
      ),
    },
    {
      header: 'Client',
      accessor: (r) => r.company?.name ?? r.companyId,
    },
    {
      header: 'Billing period',
      accessor: (r) => formatCycleLabel(r.billingCycle),
    },
    {
      header: 'Amount',
      accessor: (r) => `${formatDecimal(r.grandTotal ?? r.totalAmount)} ${CURRENCY}`,
    },
    {
      header: 'Issue date',
      accessor: (r) => formatDate(r.issuedAt ?? r.createdAt),
    },
    {
      header: 'Due date',
      accessor: (r) => formatDate(r.dueDate),
    },
    {
      header: 'Status',
      accessor: (r) => (
        <span className={`w-fit ${invoiceStatusClass(r.status)}`}>
          {humanizeInvoiceStatus(r.status)}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: (r) => (
        <div className="relative" data-billing-action-trigger="true" onClick={(e) => e.stopPropagation()}>
          <AnchoredDropdown
            open={openActionId === r.id}
            align="end"
            menuRootProps={{ 'data-billing-action-menu': 'true' }}
            trigger={
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-body transition hover:bg-surface-card-muted"
                data-billing-action-menu-button="true"
                onClick={() => setOpenActionId((cur) => (cur === r.id ? null : r.id))}
                aria-label="Open actions"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path d="M4 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm4.5 0a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 8.5 10ZM13 10a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 13 10Z" />
                </svg>
              </button>
            }
          >
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-sunken"
              onClick={() => {
                setOpenActionId(null);
                navigate(`/billing/invoices/${r.id}`);
              }}
            >
              View
            </button>
            {canMutate ? (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-sunken"
                onClick={() => {
                  setOpenActionId(null);
                  navigate(`/billing/invoices/${r.id}`);
                }}
              >
                Edit
              </button>
            ) : null}
            {canMutate &&
            (r.status === 'unpaid' || r.status === 'open' || r.status === 'overdue') ? (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-sunken"
                onClick={() => statusMut.mutate({ id: r.id, status: 'paid' })}
              >
                Mark as paid
              </button>
            ) : null}
            {canMutate && (r.status === 'draft' || r.status === 'cancelled') ? (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-status-error-fg hover:bg-status-error-bg"
                onClick={() => {
                  if (!window.confirm(`Delete invoice ${r.invoiceNumber}?`)) return;
                  deleteMut.mutate(r.id);
                }}
              >
                Delete
              </button>
            ) : null}
          </AnchoredDropdown>
        </div>
      ),
    },
  ];

  return (
    <AdminListPageShell
      icon="fa-file-invoice"
      title="Invoices"
      subtitle="Client billing invoices across all sources."
    >
      <FilterPanel
        title="Invoice filters"
        onApply={applyFilters}
        onReset={resetFilters}
        loading={pagination.isFetching}
        applyLabel="Apply filters"
        resetLabel="Reset filters"
      >
        <TextField
          label="Invoice #"
          value={draftFilters.search}
          onChange={(e) => setDraft({ search: e.target.value })}
          placeholder="Search invoice..."
          className="font-mono"
        />
        <Combobox
          label="Client"
          value={draftFilters.companyId}
          onChange={(v) => setDraft({ companyId: v })}
          options={companyFilterComboboxOptions(companiesQuery.data, 'All clients')}
          placeholder="All clients"
        />
        <SelectField
          label="Status"
          value={draftFilters.status}
          onChange={(e) => setDraft({ status: e.target.value as InvoiceStatusFilter })}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'draft', label: 'Draft' },
            { value: 'unpaid', label: 'Issued' },
            { value: 'overdue', label: 'Overdue' },
            { value: 'paid', label: 'Paid' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
        <TextField
          label="Created from"
          type="date"
          value={draftFilters.createdFrom}
          onChange={(e) => setDraft({ createdFrom: e.target.value })}
        />
        <TextField
          label="Created to"
          type="date"
          value={draftFilters.createdTo}
          onChange={(e) => setDraft({ createdTo: e.target.value })}
        />
        <SelectField
          label="Sort by"
          value={draftFilters.sort_by}
          onChange={(e) => setDraft({ sort_by: e.target.value as ListFilters['sort_by'] })}
          options={[
            { value: 'createdAt', label: 'Created' },
            { value: 'issuedAt', label: 'Issue date' },
            { value: 'invoiceNumber', label: 'Invoice number' },
            { value: 'totalAmount', label: 'Amount' },
            { value: 'status', label: 'Status' },
          ]}
        />
        <SelectField
          label="Sort direction"
          value={draftFilters.sort_dir}
          onChange={(e) => setDraft({ sort_dir: e.target.value as 'asc' | 'desc' })}
          options={[
            { value: 'desc', label: 'Descending' },
            { value: 'asc', label: 'Ascending' },
          ]}
        />
      </FilterPanel>

      <DataTable
        description="Click a row to view invoice details."
        columns={columns}
        rows={pagination.rows}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/billing/invoices/${r.id}`)}
        loading={pagination.isInitialLoading}
        empty="No invoices match your filters."
        serverPagination={pagination.serverPagination}
      />

      {pagination.isError ? (
        <p className="text-sm text-status-error-fg">{(pagination.error as Error).message}</p>
      ) : null}
    </AdminListPageShell>
  );
}
