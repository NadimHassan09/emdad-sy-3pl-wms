import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { BillingApi, type BillingInvoiceRow } from '../../api/billing';
import { CompaniesApi } from '../../api/companies';
import { Combobox } from '../../components/Combobox';
import { DataTable, type Column } from '../../components/DataTable';
import { FilterPanel } from '../../components/FilterPanel';
import { SelectField } from '../../components/SelectField';
import { StatusBadge } from '../../components/StatusBadge';
import { TextField } from '../../components/TextField';
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
  type InvoiceListFilters,
  type InvoiceStatusFilter,
} from '../../lib/billing-invoice-display';

type ListFilters = InvoiceListFilters & {
  search: string;
  cycleStatus: '' | 'active' | 'renewed' | 'expired';
  expiryFrom: string;
  expiryTo: string;
  sort_by: 'createdAt' | 'invoiceNumber' | 'totalAmount' | 'status';
  sort_dir: 'asc' | 'desc';
};

const INITIAL_FILTERS: ListFilters = {
  companyId: '',
  search: '',
  status: '',
  cycleStatus: '',
  dateFrom: '',
  dateTo: '',
  expiryFrom: '',
  expiryTo: '',
  sort_by: 'createdAt',
  sort_dir: 'desc',
};

export function BillingInvoicesPage() {
  const navigate = useNavigate();

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters<ListFilters>(INITIAL_FILTERS);

  const companiesQuery = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list({ includeAll: true }),
  });

  const companyNameById = useMemo(
    () => new Map((companiesQuery.data ?? []).map((c) => [c.id, c.name])),
    [companiesQuery.data],
  );

  const serverFilters = useMemo(
    () => ({
      companyId: appliedFilters.companyId.trim() || undefined,
      search: appliedFilters.search.trim() || undefined,
      status: appliedFilters.status || undefined,
      cycleStatus: appliedFilters.cycleStatus || undefined,
      createdFrom: appliedFilters.dateFrom || undefined,
      createdTo: appliedFilters.dateTo || undefined,
      expiryFrom: appliedFilters.expiryFrom || undefined,
      expiryTo: appliedFilters.expiryTo || undefined,
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

  const columns: Column<BillingInvoiceRow>[] = [
    {
      header: 'Invoice number',
      accessor: (r) => (
        <span className="font-mono text-sm font-semibold text-brand-700">{r.invoiceNumber}</span>
      ),
    },
    {
      header: 'Client',
      accessor: (r) => companyNameById.get(r.companyId) ?? r.companyId,
    },
    {
      header: 'Cycle',
      accessor: (r) => formatCycleLabel(r.billingCycle),
    },
    {
      header: 'Amount',
      accessor: (r) => formatDecimal(r.totalAmount),
    },
    {
      header: 'Status',
      accessor: (r) => <StatusBadge status={r.status} />,
    },
    {
      header: 'Created',
      accessor: (r) => formatDate(r.createdAt),
    },
  ];

  return (
    <div className="space-y-4">
      <FilterPanel
        title="Invoice filters"
        onApply={applyFilters}
        onReset={resetFilters}
        loading={pagination.isFetching}
      >
        <TextField
          label="Search invoice"
          value={draftFilters.search}
          onChange={(e) => setDraft({ search: e.target.value })}
          placeholder="Invoice number"
        />
        <Combobox
          label="Client"
          value={draftFilters.companyId}
          onChange={(v) => setDraft({ companyId: v })}
          options={companyFilterComboboxOptions(companiesQuery.data, 'All clients')}
        />
        <SelectField
          label="Status"
          value={draftFilters.status}
          onChange={(e) => {
            const v = e.target.value as unknown as InvoiceStatusFilter;
            setDraft({ status: v });
          }}
          options={[
            { value: '', label: 'All' },
            { value: 'draft', label: 'Draft' },
            { value: 'open', label: 'Open' },
            { value: 'paid', label: 'Paid' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
        <SelectField
          label="Cycle status"
          value={draftFilters.cycleStatus}
          onChange={(e) =>
            setDraft({ cycleStatus: e.target.value as ListFilters['cycleStatus'] })
          }
          options={[
            { value: '', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'renewed', label: 'Renewed' },
            { value: 'expired', label: 'Expired' },
          ]}
        />
        <TextField
          label="Date from"
          type="date"
          value={draftFilters.dateFrom}
          onChange={(e) => setDraft({ dateFrom: e.target.value })}
        />
        <TextField
          label="Date to"
          type="date"
          value={draftFilters.dateTo}
          onChange={(e) => setDraft({ dateTo: e.target.value })}
        />
        <TextField
          label="Cycle expiry from"
          type="date"
          value={draftFilters.expiryFrom}
          onChange={(e) => setDraft({ expiryFrom: e.target.value })}
        />
        <TextField
          label="Cycle expiry to"
          type="date"
          value={draftFilters.expiryTo}
          onChange={(e) => setDraft({ expiryTo: e.target.value })}
        />
        <SelectField
          label="Sort by"
          value={draftFilters.sort_by}
          onChange={(e) =>
            setDraft({ sort_by: e.target.value as ListFilters['sort_by'] })
          }
          options={[
            { value: 'createdAt', label: 'Created' },
            { value: 'invoiceNumber', label: 'Invoice number' },
            { value: 'totalAmount', label: 'Amount' },
            { value: 'status', label: 'Status' },
          ]}
        />
        <SelectField
          label="Sort direction"
          value={draftFilters.sort_dir}
          onChange={(e) =>
            setDraft({ sort_dir: e.target.value as 'asc' | 'desc' })
          }
          options={[
            { value: 'desc', label: 'Descending' },
            { value: 'asc', label: 'Ascending' },
          ]}
        />
      </FilterPanel>

      <DataTable
        title="Invoices"
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
        <p className="text-sm text-rose-600">{(pagination.error as Error).message}</p>
      ) : null}
    </div>
  );
}
