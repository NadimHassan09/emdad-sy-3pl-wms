import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { BillingApi } from '../../api/billing';
import { CompaniesApi } from '../../api/companies';
import { Combobox } from '../../components/Combobox';
import { DataTable, type Column } from '../../components/DataTable';
import { FilterPanel } from '../../components/FilterPanel';
import { SelectField } from '../../components/SelectField';
import { StatusBadge } from '../../components/StatusBadge';
import { TextField } from '../../components/TextField';
import { QK } from '../../constants/query-keys';
import { useFilters } from '../../hooks/useFilters';
import { companyFilterComboboxOptions } from '../../lib/company-filter-options';
import {
  filterInvoiceRows,
  formatCycleLabel,
  formatDate,
  formatDecimal,
  type InvoiceListFilters,
  type InvoiceStatusFilter,
} from '../../lib/billing-invoice-display';
import type { BillingInvoiceRow } from '../../api/billing';

const INITIAL_FILTERS: InvoiceListFilters = {
  companyId: '',
  status: '',
  dateFrom: '',
  dateTo: '',
};

export function BillingInvoicesPage() {
  const navigate = useNavigate();

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters<InvoiceListFilters>(INITIAL_FILTERS);

  const companiesQuery = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list({ includeAll: true }),
  });

  const invoicesQuery = useQuery({
    queryKey: QK.billing.invoices,
    queryFn: () => BillingApi.listInvoices(),
  });

  const companyNameById = useMemo(
    () => new Map((companiesQuery.data ?? []).map((c) => [c.id, c.name])),
    [companiesQuery.data],
  );

  const filteredRows = useMemo(
    () => filterInvoiceRows(invoicesQuery.data ?? [], appliedFilters),
    [invoicesQuery.data, appliedFilters],
  );

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

  const isLoading = invoicesQuery.isLoading || companiesQuery.isLoading;

  return (
    <div className="space-y-4">
      <FilterPanel
        title="Invoice filters"
        onApply={applyFilters}
        onReset={resetFilters}
        loading={invoicesQuery.isFetching}
      >
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
      </FilterPanel>

      <DataTable
        title="Invoices"
        description="Click a row to view invoice details."
        columns={columns}
        rows={filteredRows}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/billing/invoices/${r.id}`)}
        loading={isLoading}
        empty="No invoices match your filters."
      />

      {invoicesQuery.error ? (
        <p className="text-sm text-rose-600">{(invoicesQuery.error as Error).message}</p>
      ) : null}
    </div>
  );
}
