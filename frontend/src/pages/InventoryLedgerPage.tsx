import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { CompaniesApi } from '../api/companies';
import { InventoryApi, LedgerRow } from '../api/inventory';
import { ProductsApi } from '../api/products';
import { Combobox } from '../components/Combobox';
import { Column, DataTable } from '../components/DataTable';
import { FilterActions } from '../components/FilterActions';
import { FilterPanel } from '../components/FilterPanel';
import { PageHeader } from '../components/PageHeader';
import { TextField } from '../components/TextField';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import { useFilters } from '../hooks/useFilters';
import { companyFilterComboboxOptions } from '../lib/company-filter-options';
import {
  fmtLedgerQty,
  fmtSignedDelta,
  ledgerEntryDetailPath,
  ledgerGroupRefLabel,
  ledgerQuantityDisplay,
} from '../lib/ledger-display';

type LedgerDraft = {
  productId: string;
  movementType: '' | 'inbound' | 'outbound' | 'adjustment';
  companyId: string;
  createdFrom: string;
  createdTo: string;
};

function ledgerRowKey(r: LedgerRow): string {
  return `${r.id}:${r.createdAt}`;
}

export function InventoryLedgerPage() {
  const isArabic =
    typeof window !== 'undefined' && (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const navigate = useNavigate();
  const { warehouseId: wid } = useDefaultWarehouseId();
  const initial = useMemo<LedgerDraft>(
    () => ({
      productId: '',
      movementType: '',
      companyId: '',
      createdFrom: '',
      createdTo: '',
    }),
    [],
  );

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(initial);

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
  });

  const clientFilterOptions = useMemo(
    () => companyFilterComboboxOptions(companies.data, t('All clients', 'كل العملاء')),
    [companies.data, isArabic],
  );

  const products = useQuery({
    queryKey: [...QK.products, 'ledger-dropdown'],
    queryFn: () => ProductsApi.list({ limit: 500 }),
    staleTime: 15 * 60_000,
  });

  const ledgerParams = useMemo(
    () => ({
      warehouseId: wid || undefined,
      productId: appliedFilters.productId || undefined,
      companyId: appliedFilters.companyId || undefined,
      movementType: appliedFilters.movementType || undefined,
      createdFrom: appliedFilters.createdFrom.trim() || undefined,
      createdTo: appliedFilters.createdTo.trim() || undefined,
    }),
    [appliedFilters, wid],
  );

  const ledger = useQuery({
    queryKey: [...QK.ledger, ledgerParams],
    queryFn: () => InventoryApi.ledger({ limit: 500, ...ledgerParams }),
    enabled: !!wid,
  });

  const ledgerRows = useMemo(() => ledger.data?.items ?? [], [ledger.data?.items]);

  const columns: Column<LedgerRow>[] = useMemo(
    () => [
      {
        header: t('Product', 'المنتج'),
        accessor: (r) => (
          <div>
            <div className="font-medium text-slate-900">{r.product.name}</div>
            <div className="font-mono text-xs text-slate-500">{r.product.sku}</div>
          </div>
        ),
      },
      {
        header: t('Client', 'العميل'),
        accessor: (r) => r.company.name,
        width: '140px',
      },
      {
        header: t('Movement type', 'نوع الحركة'),
        accessor: (r) => <span className="font-mono text-xs text-slate-700">{r.movementType}</span>,
        width: '130px',
      },
      {
        header: t('When', 'الوقت'),
        accessor: (r) => new Date(r.createdAt).toLocaleString(),
        width: '160px',
      },
      {
        header: t('Reference', 'المرجع'),
        accessor: (r) => (
          <span className="text-xs font-mono text-slate-500">
            {ledgerGroupRefLabel(r.referenceType, r.referenceId)}
          </span>
        ),
        width: '200px',
      },
      {
        header: t('Before quantity', 'الكمية قبل'),
        accessor: (r) => {
          const { before } = ledgerQuantityDisplay(r);
          return <span className="font-mono text-slate-700">{fmtLedgerQty(before)}</span>;
        },
        width: '110px',
        className: 'text-right',
      },
      {
        header: t('Δ Qty', 'فرق الكمية'),
        accessor: (r) => {
          const { delta } = ledgerQuantityDisplay(r);
          const pos = delta > 0;
          const neg = delta < 0;
          return (
            <span
              className={`font-mono font-semibold ${pos ? 'text-emerald-600' : neg ? 'text-rose-600' : 'text-slate-600'}`}
            >
              {fmtSignedDelta(delta)}
            </span>
          );
        },
        width: '100px',
        className: 'text-right',
      },
      {
        header: t('After quantity', 'الكمية بعد'),
        accessor: (r) => {
          const { after } = ledgerQuantityDisplay(r);
          return <span className="font-mono text-slate-700">{fmtLedgerQty(after)}</span>;
        },
        width: '110px',
        className: 'text-right',
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title={t('Inventory ledger', 'سجل المخزون')}
        description={t(
          'Each row is one stock movement. Δ = after − before for that lot/location. Open a row for lot/location breakdown (deduplicated).',
          'كل صف يمثل حركة مخزون واحدة. Δ = بعد - قبل لنفس الدفعة/الموقع. افتح الصف لعرض التفاصيل.',
        )}
      />

      {!wid ? (
        <p className="text-sm text-slate-600">Resolve warehouse configuration…</p>
      ) : null}

      <FilterPanel showLabel={t('Show filters', 'إظهار الفلاتر')} hideLabel={t('Hide filters', 'إخفاء الفلاتر')}>
      <div className="flex flex-wrap gap-3">
        <Combobox
          label={t('Client', 'العميل')}
          value={draftFilters.companyId}
          onChange={(v) => setDraft({ companyId: v })}
          options={clientFilterOptions}
          placeholder={t('All clients', 'كل العملاء')}
          className="min-w-[240px]"
        />
        <Combobox
          label={t('Product', 'المنتج')}
          value={draftFilters.productId}
          onChange={(v) => setDraft({ productId: v })}
          options={(products.data?.items ?? []).map((p) => ({
            value: p.id,
            label: `${p.sku} — ${p.name}`,
          }))}
          placeholder={t('All products', 'كل المنتجات')}
          className="min-w-[280px]"
        />
        <Combobox
          label={t('Movement type', 'نوع الحركة')}
          value={draftFilters.movementType}
          onChange={(v) =>
            setDraft({ movementType: (v || '') as LedgerDraft['movementType'] })
          }
          options={[
            { value: '', label: t('All movement types', 'كل أنواع الحركات') },
            { value: 'inbound', label: t('Inbound', 'وارد') },
            { value: 'outbound', label: t('Outbound', 'صادر') },
            { value: 'adjustment', label: t('Adjustment', 'تعديل') },
          ]}
          placeholder={t('Movement type…', 'نوع الحركة…')}
          className="min-w-[200px]"
        />
        <TextField
          label={t('Created from', 'تاريخ الإنشاء من')}
          type="date"
          value={draftFilters.createdFrom}
          onChange={(e) => setDraft({ createdFrom: e.target.value })}
          className="min-w-[180px]"
        />
        <TextField
          label={t('Created to', 'تاريخ الإنشاء إلى')}
          type="date"
          value={draftFilters.createdTo}
          onChange={(e) => setDraft({ createdTo: e.target.value })}
          className="min-w-[180px]"
        />
      </div>
      <FilterActions
        onApply={applyFilters}
        onReset={resetFilters}
        loading={ledger.isFetching}
        applyLabel={t('Apply filters', 'تطبيق الفلاتر')}
        resetLabel={t('Reset filters', 'إعادة تعيين الفلاتر')}
      />
      </FilterPanel>

      <DataTable
        columns={columns}
        rows={ledgerRows}
        rowKey={ledgerRowKey}
        loading={ledger.isLoading || !wid}
        empty={wid ? 'No ledger rows for the current filters.' : 'Warehouse not resolved yet.'}
        onRowClick={(r) => navigate(ledgerEntryDetailPath(r.id, r.createdAt, r.companyId))}
        labels={{
          rowsSuffix: t('rows', 'صف'),
          resultsSuffix: t('results', 'نتيجة'),
          ofWord: t('of', 'من'),
          previous: t('Previous', 'السابق'),
          next: t('Next', 'التالي'),
          rowsPerPageAria: t('Rows per page', 'عدد الصفوف لكل صفحة'),
        }}
      />
      <p className="mt-2 text-xs text-slate-500">
        {ledger.data
          ? `${ledgerRows.length} movement(s) · ${ledger.data.total} row(s) from server`
          : ''}
      </p>
    </>
  );
}
