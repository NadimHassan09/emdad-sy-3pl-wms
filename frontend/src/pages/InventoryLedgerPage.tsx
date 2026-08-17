import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { CompaniesApi } from '../api/companies';
import { InventoryApi, LedgerRow } from '../api/inventory';
import { AdminListPageShell } from '../components/AdminListPageShell';
import { BarcodeScanModal } from '../components/BarcodeScanModal';
import { Combobox } from '../components/Combobox';
import { Column, DataTable } from '../components/DataTable';
import { FilterPanel } from '../components/FilterPanel';
import { FilterScanButton } from '../components/FilterScanButton';
import { SelectField } from '../components/SelectField';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';
import { useFilters } from '../hooks/useFilters';
import { companyFilterComboboxOptions } from '../lib/company-filter-options';
import {
  fmtSignedDelta,
  ledgerEntryDetailPath,
  ledgerMovementCategory,
  ledgerMovementLabel,
  ledgerSignedChange,
} from '../lib/ledger-display';

type LedgerSearchCategory = 'name' | 'sku' | 'barcode';

type LedgerDraft = {
  searchQuery: string;
  searchCategory: LedgerSearchCategory;
  movementType: '' | 'inbound' | 'outbound' | 'return';
  includeInternal: boolean;
  companyId: string;
  createdFrom: string;
  createdTo: string;
};

function ledgerSearchParams(filters: LedgerDraft, warehouseId: string | undefined) {
  const q = filters.searchQuery.trim();
  const base = {
    warehouseId: warehouseId || undefined,
    companyId: filters.companyId.trim() || undefined,
    movementType: filters.movementType || undefined,
    includeInternal: filters.includeInternal || undefined,
    createdFrom: filters.createdFrom.trim() || undefined,
    createdTo: filters.createdTo.trim() || undefined,
  };
  if (!q) return base;
  switch (filters.searchCategory) {
    case 'name':
      return { ...base, productName: q };
    case 'sku':
      return { ...base, sku: q };
    case 'barcode':
      return { ...base, productBarcode: q };
    default:
      return base;
  }
}

function ledgerRowKey(r: LedgerRow): string {
  return `${r.id}:${r.createdAt}`;
}

export function InventoryLedgerPage() {
  const isArabic =
    typeof window !== 'undefined' && (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const navigate = useNavigate();
  const toast = useToast();
  const [scanOpen, setScanOpen] = useState(false);
  const { warehouseId: wid } = useDefaultWarehouseId();
  const initial = useMemo<LedgerDraft>(
    () => ({
      searchQuery: '',
      searchCategory: 'name',
      movementType: '',
      includeInternal: false,
      companyId: '',
      createdFrom: '',
      createdTo: '',
    }),
    [],
  );

  const searchCategoryOptions = useMemo(
    () => [
      { value: 'name', label: t('Product name', 'اسم المنتج') },
      { value: 'sku', label: t('SKU', 'رمز الصنف') },
      { value: 'barcode', label: t('Barcode', 'الباركود') },
    ],
    [isArabic],
  );

  const { draftFilters, appliedFilters, setDraft, applyFilters, applyPatch, resetFilters } =
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

  const ledgerParams = useMemo(
    () => ledgerSearchParams(appliedFilters, wid || undefined),
    [appliedFilters, wid],
  );

  const pagination = useChunkedServerPagination<LedgerRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: ledgerParams,
    fetchChunk: (offset, limit) => InventoryApi.ledger({ ...ledgerParams, offset, limit }),
    rtQueryKeyPrefix: QK.ledger,
    chunkQueryKeyPrefix: 'ledger-chunk',
    enabled: !!wid,
  });

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));

  const columns: Column<LedgerRow>[] = useMemo(
    () => [
      {
        header: t('Product', 'المنتج'),
        accessor: (r) => <span className="font-medium text-text-strong">{r.product.name}</span>,
      },
      {
        header: t('SKU', 'رمز الصنف'),
        accessor: (r) => (
          <span className="font-mono text-xs text-text-muted">{r.product.sku}</span>
        ),
        width: '120px',
      },
      {
        header: t('Client', 'العميل'),
        accessor: (r) => r.company.name,
        width: '140px',
      },
      {
        header: t('Movement type', 'نوع الحركة'),
        accessor: (r) => (
          <span className="text-sm font-medium text-text-strong">
            {ledgerMovementLabel(ledgerMovementCategory(r.movementType))}
          </span>
        ),
        width: '130px',
      },
      {
        header: t('When', 'الوقت'),
        accessor: (r) => new Date(r.createdAt).toLocaleString(),
        width: '160px',
      },
      {
        header: t('Quantity', 'الكمية'),
        accessor: (r) => {
          const delta = ledgerSignedChange(r);
          const pos = delta > 0;
          const neg = delta < 0;
          return (
            <span
              className={`font-mono font-semibold ${pos ? 'text-status-success-fg' : neg ? 'text-status-danger-fg' : 'text-text-body'}`}
            >
              {fmtSignedDelta(delta)}
            </span>
          );
        },
        width: '110px',
        className: 'text-right',
      },
    ],
    [isArabic],
  );

  return (
    <AdminListPageShell
      icon="fa-book"
      title={t('Inventory ledger', 'سجل المخزون')}
      isArabic={isArabic}
    >
      {!wid ? (
        <p className="text-sm text-text-body">Resolve warehouse configuration…</p>
      ) : null}

      <FilterPanel
        title={t('Ledger filters', 'فلاتر السجل')}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={pagination.isFetching}
        applyLabel={t('Apply filters', 'تطبيق الفلاتر')}
        resetLabel={t('Reset filters', 'إعادة تعيين الفلاتر')}
        compact={
          <TextField
            label={t('Search', 'بحث')}
            value={draftFilters.searchQuery}
            onChange={(e) => setDraft({ searchQuery: e.target.value })}
            placeholder={t('Contains…', 'يحتوي على…')}
            className={draftFilters.searchCategory !== 'name' ? 'font-mono text-xs' : undefined}
          />
        }
        activeCount={[appliedFilters.searchQuery, appliedFilters.movementType, appliedFilters.companyId, appliedFilters.createdFrom, appliedFilters.createdTo].filter((v) => String(v).trim()).length + (appliedFilters.includeInternal ? 1 : 0)}
        advancedLabel={t('Advanced Filtering', 'تصفية متقدمة')}
        collapseLabel={t('Collapsed', 'إخفاء')}
      >
        <TextField
          label={t('Search', 'بحث')}
          value={draftFilters.searchQuery}
          onChange={(e) => setDraft({ searchQuery: e.target.value })}
          placeholder={t('Contains…', 'يحتوي على…')}
          className={draftFilters.searchCategory !== 'name' ? 'font-mono text-xs' : undefined}
        />
        <SelectField
          label={t('Search by', 'البحث حسب')}
          name="ledgerSearchCategory"
          value={draftFilters.searchCategory}
          onChange={(e) =>
            setDraft({ searchCategory: e.target.value as LedgerSearchCategory })
          }
          options={searchCategoryOptions}
        />
        <FilterScanButton
          label={t('Barcode', 'الباركود')}
          onClick={() => setScanOpen(true)}
          title={t('Scan a barcode with the device camera', 'امسح باركود باستخدام كاميرا الجهاز')}
          ariaLabel={t('Scan barcode', 'مسح الباركود')}
        />
        <SelectField
          label={t('Movement type', 'نوع الحركة')}
          name="movementType"
          value={draftFilters.movementType}
          onChange={(e) =>
            setDraft({ movementType: e.target.value as LedgerDraft['movementType'] })
          }
          options={[
            { value: '', label: t('All (filtered)', 'الكل (مفلتر)') },
            { value: 'inbound', label: t('Inbound', 'وارد') },
            { value: 'outbound', label: t('Outbound', 'صادر') },
            { value: 'return', label: t('Return', 'مرتجع') },
          ]}
        />
        <label className="flex cursor-pointer items-start gap-2.5 pt-6">
          <input
            type="checkbox"
            checked={draftFilters.includeInternal}
            onChange={(e) => setDraft({ includeInternal: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-border-strong text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm text-text-body">
            <span className="font-medium text-text-strong">
              {t('Show internal operations', 'إظهار العمليات الداخلية')}
            </span>
            <span className="mt-0.5 block text-xs text-text-muted">
              {t(
                'Adjustments, transfers, scrap, and QC',
                'التعديلات والتحويلات والإتلاف وفحص الجودة',
              )}
            </span>
          </span>
        </label>
        <Combobox
          label={t('Client', 'العميل')}
          value={draftFilters.companyId}
          onChange={(v) => setDraft({ companyId: v })}
          options={clientFilterOptions}
          placeholder={t('All clients', 'كل العملاء')}
        />
        <TextField
          label={t('Created from', 'تاريخ الإنشاء من')}
          type="date"
          value={draftFilters.createdFrom}
          onChange={(e) => setDraft({ createdFrom: e.target.value })}
        />
        <TextField
          label={t('Created to', 'تاريخ الإنشاء إلى')}
          type="date"
          value={draftFilters.createdTo}
          onChange={(e) => setDraft({ createdTo: e.target.value })}
        />
      </FilterPanel>

      <DataTable
        columns={columns}
        rows={pagination.rows}
        rowKey={ledgerRowKey}
        loading={pagination.isInitialLoading || !wid}
        empty={wid ? 'No ledger rows for the current filters.' : 'Warehouse not resolved yet.'}
        onRowClick={(r) => navigate(ledgerEntryDetailPath(r.id, r.createdAt, r.companyId))}
        serverPagination={pagination.serverPagination}
        labels={{
          rowsSuffix: t('rows', 'صف'),
          resultsSuffix: t('results', 'نتيجة'),
          ofWord: t('of', 'من'),
          previous: t('Previous', 'السابق'),
          next: t('Next', 'التالي'),
          rowsPerPageAria: t('Rows per page', 'عدد الصفوف لكل صفحة'),
        }}
      />
      <p className="mt-2 text-xs text-text-muted">
        {pagination.total > 0
          ? t(
              `${pagination.total} movement(s) · page ${pagination.page} of ${totalPages}`,
              `${pagination.total} حركة · صفحة ${pagination.page} من ${totalPages}`,
            )
          : ''}
      </p>

      <BarcodeScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(text) => {
          applyPatch({ searchCategory: 'barcode', searchQuery: text.trim() });
          toast.success(
            t('Barcode scanned — search updated.', 'تم مسح الباركود — تم تحديث البحث.'),
          );
        }}
        onCameraError={(msg) => toast.error(msg)}
      />
    </AdminListPageShell>
  );
}
