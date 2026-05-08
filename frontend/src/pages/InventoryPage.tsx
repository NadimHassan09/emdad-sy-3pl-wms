import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { CompaniesApi } from '../api/companies';
import { InventoryApi, ProductStockSummaryRow } from '../api/inventory';
import { BarcodeScanModal } from '../components/BarcodeScanModal';
import { Button } from '../components/Button';
import { Combobox } from '../components/Combobox';
import { Column, DataTable } from '../components/DataTable';
import { FilterActions } from '../components/FilterActions';
import { FilterPanel } from '../components/FilterPanel';
import { PageHeader } from '../components/PageHeader';
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

type InvDraftFilters = {
  companyId: string;
  name: string;
  sku: string;
  barcode: string;
  lotNumber: string;
  inboundOrderNumber: string;
};

export function InventoryPage() {
  const isArabic =
    typeof window !== 'undefined' && (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const navigate = useNavigate();
  const toast = useToast();
  const { warehouseId: warehouseIdForced } = useDefaultWarehouseId();
  const [companyId] = useState<string | ''>(
    () => (import.meta.env.VITE_MOCK_COMPANY_ID as string | undefined) ?? '',
  );
  const [scanOpen, setScanOpen] = useState(false);

  const initialInvFilters = useMemo<InvDraftFilters>(
    () => ({
      companyId: '',
      name: '',
      sku: '',
      barcode: '',
      lotNumber: '',
      inboundOrderNumber: '',
    }),
    [],
  );

  const { draftFilters, appliedFilters, setDraft, applyFilters, applyPatch, resetFilters } =
    useFilters(initialInvFilters);

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
  });

  const summaryParams = useMemo(
    () => ({
      warehouseId: warehouseIdForced || undefined,
      companyId: appliedFilters.companyId.trim() || companyId || undefined,
      productName: appliedFilters.name.trim() || undefined,
      sku: appliedFilters.sku.trim() || undefined,
      productBarcode: appliedFilters.barcode.trim() || undefined,
      lotNumber: appliedFilters.lotNumber.trim() || undefined,
      inboundOrderNumber: appliedFilters.inboundOrderNumber.trim() || undefined,
    }),
    [appliedFilters, warehouseIdForced, companyId],
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
      <PageHeader
        title={t('Inventory', 'المخزون')}
        description={t('Totals for the configured default warehouse — click a row for lot/location detail.', 'إجماليات المستودع الافتراضي المحدد — اضغط على أي صف لعرض تفاصيل الدفعة/الموقع.')}
      />

      {!warehouseIdForced ? (
        <p className="text-sm text-slate-600">Resolve warehouse configuration…</p>
      ) : null}

      <FilterPanel showLabel={t('Show filters', 'إظهار الفلاتر')} hideLabel={t('Hide filters', 'إخفاء الفلاتر')}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <Combobox
            label={t('Client filter', 'فلتر العميل')}
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
            className="min-w-[220px] max-w-xs"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <TextField
            label={t('Product name', 'اسم المنتج')}
            value={draftFilters.name}
            onChange={(e) => setDraft({ name: e.target.value })}
            placeholder={t('Contains…', 'يحتوي على…')}
          />
          <TextField
            label={t('SKU', 'رمز الصنف')}
            className="font-mono"
            value={draftFilters.sku}
            onChange={(e) => setDraft({ sku: e.target.value })}
            placeholder={t('Contains…', 'يحتوي على…')}
          />
          <div className="flex items-end gap-2">
            <TextField
              label={t('Barcode', 'الباركود')}
              className="min-w-0 flex-1 font-mono"
              value={draftFilters.barcode}
              onChange={(e) => setDraft({ barcode: e.target.value })}
              placeholder={t('Contains…', 'يحتوي على…')}
            />
            <Button
              type="button"
              variant="secondary"
              className="shrink-0"
              title={t('Scan a barcode with the device camera', 'امسح باركود باستخدام كاميرا الجهاز')}
              onClick={() => setScanOpen(true)}
            >
              {t('Scan', 'مسح')}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <TextField
            label={t('Lot number', 'رقم الدفعة')}
            value={draftFilters.lotNumber}
            onChange={(e) => setDraft({ lotNumber: e.target.value })}
            placeholder={t('Contains…', 'يحتوي على…')}
          />
          <TextField
            label={t('Inbound order number', 'رقم طلب الوارد')}
            value={draftFilters.inboundOrderNumber}
            onChange={(e) => setDraft({ inboundOrderNumber: e.target.value })}
            placeholder={t('Contains…', 'يحتوي على…')}
            hint={t('Matches inbound order number; narrows stock that was received on matching orders.', 'يطابق رقم طلب الوارد؛ يضيّق المخزون المستلم على الطلبات المطابقة.')}
          />
        </div>
        <FilterActions
          onApply={applyFilters}
          onReset={resetFilters}
          loading={summary.isFetching}
          applyLabel={t('Apply filters', 'تطبيق الفلاتر')}
          resetLabel={t('Reset filters', 'إعادة تعيين الفلاتر')}
        />
      </div>
      </FilterPanel>

      <DataTable
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
          applyPatch({ barcode: text.trim() });
          toast.success('Barcode scanned — barcode filter updated.');
        }}
        onCameraError={(msg) => toast.error(msg)}
      />
    </>
  );
}
