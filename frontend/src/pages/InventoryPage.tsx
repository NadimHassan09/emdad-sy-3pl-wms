import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Alert } from '@ds';

import { CompaniesApi } from '../api/companies';
import { InventoryApi, ProductStockSummaryRow } from '../api/inventory';
import { AdminListPageShell } from '../components/AdminListPageShell';
import { BarcodeImageModal } from '../components/BarcodeImageModal';
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
import { fmtSignedDelta, ledgerMovementCategory } from '../lib/ledger-display';

const fmtQty = (s: string): string => {
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

const UOM_OPTIONS: { value: string; label: string }[] = [
  { value: 'piece', label: 'Piece' },
  { value: 'kg', label: 'Kilogram' },
  { value: 'litre', label: 'Litre' },
  { value: 'carton', label: 'Carton' },
  { value: 'pallet', label: 'Pallet' },
  { value: 'box', label: 'Box' },
  { value: 'roll', label: 'Roll' },
];

function uomLabel(uom: string) {
  return UOM_OPTIONS.find((o) => o.value === uom)?.label ?? uom;
}

function LastMovementCell({ row }: { row: ProductStockSummaryRow }) {
  const mv = row.lastMovement;
  if (!mv) return <span className="text-text-faint">—</span>;
  const n = Number(mv.quantityChange);
  const cat = ledgerMovementCategory(mv.movementType);
  const up = n > 0 || cat === 'inbound' || cat === 'return';
  const down = n < 0 || cat === 'outbound';
  const color =
    up && !down
      ? 'text-emerald-600 dark:text-emerald-400'
      : down
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-text-muted';
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-sm font-semibold tabular-nums ${color}`}
    >
      <span aria-hidden>{n < 0 || down ? '▼' : '▲'}</span>
      {fmtSignedDelta(Number.isFinite(n) ? n : 0)}
    </span>
  );
}

type InventorySearchCategory = 'name' | 'sku' | 'barcode' | 'lotNumber' | 'inboundOrderNumber';

type InvDraftFilters = {
  companyId: string;
  searchCategory: InventorySearchCategory;
  searchQuery: string;
};

function inventorySearchParams(
  filters: InvDraftFilters,
  warehouseId: string | undefined,
): {
  warehouseId?: string;
  companyId?: string;
  productName?: string;
  sku?: string;
  productBarcode?: string;
  lotNumber?: string;
  inboundOrderNumber?: string;
} {
  const q = filters.searchQuery.trim();
  const base = {
    warehouseId: warehouseId || undefined,
    companyId: filters.companyId.trim() || undefined,
  };
  if (!q) return base;
  switch (filters.searchCategory) {
    case 'name':
      return { ...base, productName: q };
    case 'sku':
      return { ...base, sku: q };
    case 'barcode':
      return { ...base, productBarcode: q };
    case 'lotNumber':
      return { ...base, lotNumber: q };
    case 'inboundOrderNumber':
      return { ...base, inboundOrderNumber: q };
    default:
      return base;
  }
}

export function InventoryPage() {
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const navigate = useNavigate();
  const toast = useToast();
  const { warehouseId: warehouseIdForced } = useDefaultWarehouseId();
  const [scanOpen, setScanOpen] = useState(false);
  const [barcodePreview, setBarcodePreview] = useState<{ value: string; name: string } | null>(
    null,
  );

  const initialInvFilters = useMemo<InvDraftFilters>(
    () => ({
      companyId: '',
      searchCategory: 'name',
      searchQuery: '',
    }),
    [],
  );

  const searchCategoryOptions = useMemo(
    () => [
      { value: 'name', label: t('Product name', 'اسم المنتج') },
      { value: 'sku', label: t('SKU', 'رمز الصنف') },
      { value: 'barcode', label: t('Barcode', 'الباركود') },
      { value: 'lotNumber', label: t('Lot number', 'رقم الدفعة') },
      { value: 'inboundOrderNumber', label: t('Inbound order number', 'رقم طلب الوارد') },
    ],
    [isArabic],
  );

  const { draftFilters, appliedFilters, setDraft, applyFilters, applyPatch, resetFilters } =
    useFilters(initialInvFilters);

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
  });

  const summaryParams = useMemo(
    () => inventorySearchParams(appliedFilters, warehouseIdForced || undefined),
    [appliedFilters, warehouseIdForced],
  );

  const pagination = useChunkedServerPagination<ProductStockSummaryRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: summaryParams,
    fetchChunk: (offset, limit) =>
      InventoryApi.stockByProductSummary({ ...summaryParams, offset, limit }),
    rtQueryKeyPrefix: QK.inventoryStockByProduct,
    chunkQueryKeyPrefix: 'inventory-stock-by-product-chunk',
    enabled: !!warehouseIdForced,
  });

  const summaryColumns: Column<ProductStockSummaryRow>[] = useMemo(
    () => [
      {
        header: t('Product', 'المنتج'),
        accessor: (r) => <span className="font-medium text-text-strong">{r.product.name}</span>,
        width: '240px',
      },
      {
        header: t('Client', 'العميل'),
        accessor: (r) => r.client.name,
        width: '160px',
      },
      {
        header: t('SKU', 'رمز الصنف'),
        accessor: (r) => <span className="font-mono text-xs">{r.product.sku}</span>,
        width: '140px',
      },
      {
        header: t('Barcode', 'الباركود'),
        width: '90px',
        accessor: (r) =>
          r.product.barcode ? (
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-muted transition hover:bg-surface-hover hover:text-brand-700 dark:hover:text-brand-400"
              title={t('Show barcode', 'عرض الباركود')}
              aria-label={t('Show barcode', 'عرض الباركود')}
              onClick={(e) => {
                e.stopPropagation();
                setBarcodePreview({ value: r.product.barcode!, name: r.product.name });
              }}
            >
              <i className="fa-solid fa-barcode text-base" aria-hidden="true" />
            </button>
          ) : (
            <span className="text-text-faint">—</span>
          ),
      },
      {
        header: t('Available stock', 'المخزون المتاح'),
        accessor: (r) => (
          <span className="block text-right font-mono text-base font-bold tabular-nums text-text-strong">
            {fmtQty(r.available ?? '0')}
          </span>
        ),
        width: '140px',
        className: 'text-right',
      },
      {
        header: t('Last movement', 'آخر حركة'),
        accessor: (r) => <LastMovementCell row={r} />,
        width: '130px',
      },
      {
        header: t('Unit', 'الوحدة'),
        accessor: (r) => <span className="text-text-body">{uomLabel(r.product.uom)}</span>,
        width: '100px',
      },
    ],
    [isArabic],
  );

  return (
    <AdminListPageShell
      icon="fa-boxes-stacked"
      title={t('Inventory', 'المخزون')}
      subtitle={t(
        'Browse products and open details for stock history.',
        'تصفح المنتجات وافتح التفاصيل لسجل المخزون.',
      )}
      isArabic={isArabic}
    >
      {!warehouseIdForced && (
        <Alert
          variant="warning"
          title={t('Warehouse not configured', 'المستودع غير محدد')}
          description={t(
            'No default warehouse is set. Contact your administrator to configure warehouse settings.',
            'لم يتم تحديد مستودع افتراضي. تواصل مع المسؤول لتهيئة إعدادات المستودع.',
          )}
          className="mb-4"
        />
      )}

      {pagination.isError && (
        <Alert
          variant="error"
          title={t('Failed to load inventory', 'فشل تحميل المخزون')}
          description={t(
            'There was a problem retrieving inventory data. Check your connection and try again.',
            'حدثت مشكلة في جلب بيانات المخزون. تحقق من اتصالك وأعد المحاولة.',
          )}
          className="mb-4"
        >
          <Alert.Action onClick={() => pagination.refetch()}>
            {t('Retry', 'إعادة المحاولة')}
          </Alert.Action>
        </Alert>
      )}

      <FilterPanel
        title={t('Inventory filters', 'فلاتر المخزون')}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={pagination.isFetching}
        applyLabel={t('Apply filters', 'تطبيق الفلاتر')}
        resetLabel={t('Reset filters', 'إعادة تعيين الفلاتر')}
      >
        <TextField
          label={t('Search', 'بحث')}
          value={draftFilters.searchQuery}
          onChange={(e) => setDraft({ searchQuery: e.target.value })}
          placeholder={t('Contains…', 'يحتوي على…')}
          className={draftFilters.searchCategory !== 'name' ? 'font-mono' : undefined}
        />
        <SelectField
          label={t('Search by', 'البحث حسب')}
          name="searchCategory"
          value={draftFilters.searchCategory}
          onChange={(e) =>
            setDraft({ searchCategory: e.target.value as InventorySearchCategory })
          }
          options={searchCategoryOptions}
        />
        <FilterScanButton
          label={t('Barcode', 'الباركود')}
          onClick={() => setScanOpen(true)}
          title={t('Scan a barcode with the device camera', 'امسح باركود باستخدام كاميرا الجهاز')}
          ariaLabel={t('Scan barcode', 'مسح الباركود')}
        />
        <Combobox
          label={t('Client', 'العميل')}
          value={draftFilters.companyId}
          onChange={(v) => setDraft({ companyId: v })}
          options={[
            { value: '', label: t('All clients', 'كل العملاء') },
            ...(companies.data ?? []).map((c) => ({
              value: c.id,
              label: c.name,
              hint: c.contactEmail,
            })),
          ]}
          placeholder={t('All clients', 'كل العملاء')}
        />
      </FilterPanel>

      <DataTable
        columns={summaryColumns}
        rows={pagination.rows}
        rowKey={(r) => r.productId}
        loading={pagination.isInitialLoading || !warehouseIdForced}
        empty={
          warehouseIdForced
            ? 'No on-hand stock matches the current filters.'
            : 'Warehouse not resolved yet.'
        }
        onRowClick={(r) => navigate(`/inventory/product/${r.productId}`)}
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

      <p className="mt-3 text-xs text-text-muted">
        {pagination.total > 0
          ? `${pagination.total} product${pagination.total === 1 ? '' : 's'} with stock`
          : ''}
      </p>

      <BarcodeImageModal
        open={!!barcodePreview}
        onClose={() => setBarcodePreview(null)}
        value={barcodePreview?.value ?? ''}
        productName={barcodePreview?.name ?? ''}
      />

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
