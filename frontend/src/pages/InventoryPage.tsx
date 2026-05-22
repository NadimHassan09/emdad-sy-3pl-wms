import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { CompaniesApi } from '../api/companies';
import { InventoryApi, ProductStockSummaryRow } from '../api/inventory';
import { BarcodeScanIcon } from '../components/BarcodeScanIcon';
import { BarcodeScanModal } from '../components/BarcodeScanModal';
import { Alert } from '@ds';
import { Button } from '../components/Button';
import { Combobox } from '../components/Combobox';
import { Column, DataTable } from '../components/DataTable';
import { FilterPanel } from '../components/FilterPanel';
import { SelectField } from '../components/SelectField';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import { useFilters } from '../hooks/useFilters';

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

const SUMMARY_COLUMNS: Column<ProductStockSummaryRow>[] = [
  {
    header: 'Product',
    accessor: (r) => <span className="font-medium text-slate-900">{r.product.name}</span>,
  },
  {
    header: 'Client',
    accessor: (r) => r.client.name,
    width: '220px',
  },
  {
    header: 'SKU',
    accessor: (r) => <span className="font-mono text-xs">{r.product.sku}</span>,
    width: '200px',
  },
  {
    header: 'Barcode',
    accessor: (r) =>
      r.product.barcode ? (
        <span className="font-mono text-xs text-slate-800">{r.product.barcode}</span>
      ) : (
        <span className="text-slate-400">—</span>
      ),
    width: '200px',
  },
  {
    header: 'Total quantity',
    accessor: (r) => (
      <span className="font-mono text-right block font-semibold">{fmtQty(r.totalQuantity)}</span>
    ),
    width: '140px',
    className: 'text-right',
  },
  {
    header: 'UOM',
    accessor: (r) => <span className="text-slate-800">{uomLabel(r.product.uom)}</span>,
    width: '110px',
  },
];

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
    typeof window !== 'undefined' && (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const navigate = useNavigate();
  const toast = useToast();
  const { warehouseId: warehouseIdForced } = useDefaultWarehouseId();
  const [scanOpen, setScanOpen] = useState(false);

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

  const summary = useQuery({
    queryKey: [...QK.inventoryStockByProduct, summaryParams],
    queryFn: () => InventoryApi.stockByProductSummary({ limit: 200, ...summaryParams }),
    enabled: !!warehouseIdForced,
  });

  const summaryColumns: Column<ProductStockSummaryRow>[] = useMemo(
    () => [
      { ...SUMMARY_COLUMNS[0], header: t('Product', 'المنتج') },
      { ...SUMMARY_COLUMNS[1], header: t('Client', 'العميل') },
      { ...SUMMARY_COLUMNS[2], header: t('SKU', 'رمز الصنف') },
      { ...SUMMARY_COLUMNS[3], header: t('Barcode', 'الباركود') },
      { ...SUMMARY_COLUMNS[4], header: t('Total quantity', 'إجمالي الكمية') },
      { ...SUMMARY_COLUMNS[5], header: t('UOM', 'وحدة القياس') },
    ],
    [isArabic],
  );

  return (
    <>
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

      {summary.isError && (
        <Alert
          variant="error"
          title={t('Failed to load inventory', 'فشل تحميل المخزون')}
          description={t(
            'There was a problem retrieving inventory data. Check your connection and try again.',
            'حدثت مشكلة في جلب بيانات المخزون. تحقق من اتصالك وأعد المحاولة.',
          )}
          className="mb-4"
        >
          <Alert.Action onClick={() => summary.refetch()}>{t('Retry', 'إعادة المحاولة')}</Alert.Action>
        </Alert>
      )}

      <FilterPanel
        title={t('Inventory filters', 'فلاتر المخزون')}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={summary.isFetching}
        applyLabel={t('Apply filters', 'تطبيق الفلاتر')}
        resetLabel={t('Reset filters', 'إعادة تعيين الفلاتر')}
      >
      <div className="flex flex-wrap items-end gap-3">
          <TextField
            label={t('Search', 'بحث')}
            value={draftFilters.searchQuery}
            onChange={(e) => setDraft({ searchQuery: e.target.value })}
            placeholder={t('Contains…', 'يحتوي على…')}
            className={`min-w-[200px] flex-1 ${draftFilters.searchCategory !== 'name' ? 'font-mono' : ''}`}
          />
          <SelectField
            label={t('Search by', 'البحث حسب')}
            name="searchCategory"
            value={draftFilters.searchCategory}
            onChange={(e) =>
              setDraft({ searchCategory: e.target.value as InventorySearchCategory })
            }
            options={searchCategoryOptions}
            className="min-w-[200px] max-w-xs shrink-0"
          />
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 px-2.5"
            title={t('Scan a barcode with the device camera', 'امسح باركود باستخدام كاميرا الجهاز')}
            aria-label={t('Scan barcode', 'مسح الباركود')}
            onClick={() => setScanOpen(true)}
          >
            <BarcodeScanIcon className="h-5 w-5" />
          </Button>
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
            className="min-w-[220px] max-w-xs shrink-0"
          />
      </div>
      </FilterPanel>

      <DataTable
        title={t('Inventory', 'المخزون')}
        columns={summaryColumns}
        rows={summary.data?.items ?? []}
        rowKey={(r) => r.productId}
        loading={summary.isLoading || !warehouseIdForced}
        empty={
          warehouseIdForced
            ? 'No on-hand stock matches the current filters.'
            : 'Warehouse not resolved yet.'
        }
        onRowClick={(r) => navigate(`/inventory/product/${r.productId}`)}
        labels={{
          rowsSuffix: t('rows', 'صف'),
          resultsSuffix: t('results', 'نتيجة'),
          ofWord: t('of', 'من'),
          previous: t('Previous', 'السابق'),
          next: t('Next', 'التالي'),
          rowsPerPageAria: t('Rows per page', 'عدد الصفوف لكل صفحة'),
        }}
      />

      <p className="mt-3 text-xs text-slate-500">
        {summary.data ? `${summary.data.total} product${summary.data.total === 1 ? '' : 's'} with stock` : ''}
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
    </>
  );
}
