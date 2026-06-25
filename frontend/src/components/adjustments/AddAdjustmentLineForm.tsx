import { useQuery } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import { type AddAdjustmentLineInput } from '../../api/adjustments';
import { InventoryApi, type StockRow } from '../../api/inventory';
import { ProductsApi, type ProductListQuery } from '../../api/products';
import { BarcodeScanIcon } from '../BarcodeScanIcon';
import { BarcodeScanModal } from '../BarcodeScanModal';
import { Button } from '../Button';
import { Combobox } from '../Combobox';
import { SelectField } from '../SelectField';
import { TextField } from '../TextField';
import { useToast } from '../ToastProvider';
import { QK } from '../../constants/query-keys';
import { useResolvedLocations } from '../../hooks/useResolvedLocations';
import {
  buildAdjustmentStockLocationOptions,
  uniqueStockLocationIds,
} from '../../lib/inventory-location-options';
import type { LocalizedMessage } from '../../lib/ui-i18n';
import { localizedLocationTypeLabel } from '../../lib/ui-labels/locations';

type ProductSearchCategory = 'name' | 'sku' | 'barcode';

function productListQuery(
  companyId: string,
  category: ProductSearchCategory,
  query: string,
): ProductListQuery {
  const q = query.trim();
  const base: ProductListQuery = { companyId, limit: 200 };
  if (!q) return base;
  switch (category) {
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

export function AddAdjustmentLineForm({
  scope,
  loading,
  onAdd,
}: {
  scope: { warehouseId: string; companyId: string };
  loading: boolean;
  onAdd: (payload: {
    body: AddAdjustmentLineInput;
    display: {
      sku: string;
      productName: string;
      locationPath: string;
      lotLabel?: string;
      quantityBefore: string;
    };
  }) => void;
}) {
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const resolveMsg = (msg: LocalizedMessage): string => {
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) {
      const [en, ar] = msg as readonly [string, string];
      return isArabic ? ar : en;
    }
    const obj = msg as { en: string; ar: string };
    return isArabic ? obj.ar : obj.en;
  };
  const typeLabelFn = (type: string) => localizedLocationTypeLabel(type, resolveMsg);
  const toast = useToast();
  const [productSearchCategory, setProductSearchCategory] = useState<ProductSearchCategory>('name');
  const [productSearch, setProductSearch] = useState('');
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [lotId, setLotId] = useState('');
  const [qtyAfter, setQtyAfter] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedProductSearch(productSearch.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [productSearch]);

  const productSearchCategoryOptions = useMemo(
    () => [
      { value: 'name', label: t('Product name', 'اسم المنتج') },
      { value: 'sku', label: t('SKU', 'رمز الصنف') },
      { value: 'barcode', label: t('Barcode', 'الباركود') },
    ],
    [isArabic],
  );

  const products = useQuery({
    queryKey: [
      ...QK.products,
      scope.companyId,
      'adj-form',
      productSearchCategory,
      debouncedProductSearch,
    ],
    queryFn: () =>
      ProductsApi.list(
        productListQuery(scope.companyId, productSearchCategory, debouncedProductSearch),
      ),
    enabled: !!scope.companyId,
    staleTime: 60_000,
  });

  const productMeta = useMemo(
    () => (products.data?.items ?? []).find((p) => p.id === productId),
    [products.data?.items, productId],
  );

  useEffect(() => {
    setLotId('');
    setLocationId('');
  }, [productId]);

  useEffect(() => {
    setLotId('');
  }, [locationId]);

  const lots = useQuery({
    queryKey: [...QK.products, productId, 'lots'],
    queryFn: () => ProductsApi.listLots(productId),
    enabled: !!productId && productMeta?.trackingType === 'lot',
    staleTime: 60_000,
  });

  const stockByProduct = useQuery({
    queryKey: [
      ...QK.inventoryStock,
      'adj-line-form-stock',
      scope.warehouseId,
      scope.companyId,
      productId,
    ],
    queryFn: () =>
      InventoryApi.stock({
        warehouseId: scope.warehouseId,
        companyId: scope.companyId,
        productId,
        limit: 500,
        offset: 0,
      }),
    enabled: !!productId,
    staleTime: 30_000,
  });

  const stockLocationIds = useMemo(
    () => uniqueStockLocationIds(stockByProduct.data?.items ?? []),
    [stockByProduct.data?.items],
  );

  const { locationById } = useResolvedLocations(
    productId && stockByProduct.isFetched ? stockLocationIds : [],
  );

  const adjustmentLocationsWithProduct = useMemo(
    () =>
      buildAdjustmentStockLocationOptions({
        stockItems: stockByProduct.data?.items ?? [],
        locationById,
        typeLabel: typeLabelFn,
      }),
    [stockByProduct.data?.items, locationById, isArabic],
  );

  const validProductLocationIds = useMemo(
    () => new Set(adjustmentLocationsWithProduct.map((l) => l.id)),
    [adjustmentLocationsWithProduct],
  );

  useEffect(() => {
    if (!productId || !locationId) return;
    if (!stockByProduct.isFetched) return;
    if (!validProductLocationIds.has(locationId)) setLocationId('');
  }, [productId, locationId, stockByProduct.isFetched, validProductLocationIds]);

  const stockRow = useMemo((): StockRow | null => {
    const items = stockByProduct.data?.items ?? [];
    if (!productId || !locationId) return null;

    if (productMeta?.trackingType === 'lot') {
      if (!lotId) return null;
      return (
        items.find(
          (r) =>
            r.productId === productId &&
            r.locationId === locationId &&
            (r.lotId === lotId || r.lot?.id === lotId),
        ) ?? null
      );
    }

    return (
      items.find(
        (r) =>
          r.productId === productId &&
          r.locationId === locationId &&
          !(r.lotId ?? r.lot?.id),
      ) ??
      items.find((r) => r.productId === productId && r.locationId === locationId) ??
      null
    );
  }, [stockByProduct.data?.items, productId, locationId, lotId, productMeta?.trackingType]);

  const isLotTracked = productMeta?.trackingType === 'lot';
  const showOnHandPanel = !!productId && !!locationId && (!isLotTracked || !!lotId);
  const stockQtyPending = !!productId && stockByProduct.isPending;
  const quantityUom = productMeta?.uom ?? stockRow?.product?.uom ?? '—';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!productMeta) return;

    const qty = Number(qtyAfter);
    const body: AddAdjustmentLineInput = {
      productId,
      locationId,
      quantityAfter: qty,
    };

    if (productMeta.trackingType === 'lot') {
      if (!lotId) {
        toast.error(
          t('Select an existing lot (lot-tracked product).', 'اختر دفعة موجودة (للمنتج المتتبع بالدفعات).'),
        );
        return;
      }
      body.lotId = lotId;
    }

    const loc = locationById.get(locationId);
    const lotLabel =
      productMeta.trackingType === 'lot' && lotId
        ? (lots.data ?? []).find((lot) => lot.id === lotId)?.lotNumber
        : undefined;

    onAdd({
      body,
      display: {
        sku: productMeta.sku,
        productName: productMeta.name,
        locationPath: loc?.fullPath ?? locationId,
        lotLabel,
        quantityBefore: stockRow?.quantityOnHand ?? '0',
      },
    });
    setQtyAfter('');
    setLotId('');
  };

  return (
    <div className="space-y-3 rounded-md border border-slate-200 bg-white p-3 shadow-sm">
      <form onSubmit={submit} className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t('Add line', 'إضافة بند')}
        </div>
        <div className="grid w-full grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(8.75rem,11rem)_auto]">
          <TextField
            label={t('Search', 'بحث')}
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            placeholder={t('Contains…', 'يحتوي على…')}
            className={`min-w-0 ${productSearchCategory !== 'name' ? 'font-mono' : ''}`}
          />
          <SelectField
            label={t('Search by', 'البحث حسب')}
            name="adjProductSearchCategory"
            value={productSearchCategory}
            onChange={(e) => setProductSearchCategory(e.target.value as ProductSearchCategory)}
            options={productSearchCategoryOptions}
            className="min-w-0 w-full"
          />
          <Button
            type="button"
            variant="secondary"
            className="h-[34px] w-full shrink-0 px-2.5 sm:w-auto"
            title={t('Scan a barcode with the device camera', 'امسح باركود باستخدام كاميرا الجهاز')}
            aria-label={t('Scan barcode', 'مسح الباركود')}
            onClick={() => setScanOpen(true)}
          >
            <BarcodeScanIcon className="h-5 w-5" />
          </Button>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <Combobox
            label={t('Product', 'المنتج')}
            required
            value={productId}
            onChange={setProductId}
            options={(products.data?.items ?? []).map((p) => ({
              value: p.id,
              label: `${p.sku} — ${p.name}`,
              hint: p.barcode ?? undefined,
            }))}
            placeholder={
              products.isLoading ? t('Loading…', 'جاري التحميل…') : t('Select product…', 'اختر المنتج…')
            }
            emptyMessage={t(
              'No products for this client match the search.',
              'لا توجد منتجات مطابقة لهذا العميل.',
            )}
          />
          <Combobox
            label={t('Location', 'الموقع')}
            required
            value={locationId}
            onChange={setLocationId}
            disabled={!productId || stockByProduct.isPending}
            options={adjustmentLocationsWithProduct.map((l) => ({
              value: l.id,
              label: l.label,
              hint: l.hint,
            }))}
            placeholder={
              !productId
                ? t('Select product first…', 'اختر المنتج أولاً…')
                : stockByProduct.isPending
                  ? t('Loading locations…', 'جاري تحميل المواقع…')
                  : t('Pick location…', 'اختر الموقع…')
            }
            emptyMessage={
              !productId
                ? t('Choose a product to see locations.', 'اختر منتجاً لعرض المواقع.')
                : t(
                    'No eligible locations hold this product (on-hand > 0). Receive stock first or pick another product.',
                    'لا توجد مواقع مؤهلة تحتوي هذا المنتج (كمية > 0). استلم مخزوناً أولاً أو اختر منتجاً آخر.',
                  )
            }
          />
        </div>
        {productMeta?.trackingType === 'lot' && (
          <Combobox
            label={t('Lot (required)', 'الدفعة (مطلوب)')}
            required
            value={lotId}
            onChange={setLotId}
            options={(lots.data ?? []).map((lot) => ({
              value: lot.id,
              label: lot.lotNumber,
              hint: lot.expiryDate ? `Exp ${lot.expiryDate.slice(0, 10)}` : undefined,
            }))}
            placeholder={
              lots.isLoading ? t('Loading lots…', 'جاري تحميل الدفعات…') : t('Pick lot by number', 'اختر الدفعة بالرقم')
            }
            disabled={lots.isLoading}
            emptyMessage={t(
              'No lots for this product yet — receive or create inventory first.',
              'لا توجد دفعات لهذا المنتج بعد — استلم أو أنشئ مخزوناً أولاً.',
            )}
          />
        )}

        {showOnHandPanel ? (
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <span className="font-medium text-slate-600">{t('Quantity:', 'الكمية:')}</span>{' '}
            {stockQtyPending ? (
              <span className="text-slate-400">…</span>
            ) : stockRow ? (
              <span className="font-mono font-semibold text-slate-900">
                {(() => {
                  const n = Number(stockRow.quantityOnHand);
                  return Number.isFinite(n)
                    ? n.toLocaleString(undefined, { maximumFractionDigits: 4 })
                    : String(stockRow.quantityOnHand);
                })()}
              </span>
            ) : (
              <span className="font-mono text-slate-500">—</span>
            )}
            <span className="text-slate-500"> · </span>
            <span className="font-medium text-slate-600">{t('UOM:', 'وحدة القياس:')}</span>{' '}
            <span className="uppercase text-slate-800">{quantityUom}</span>
          </div>
        ) : null}

        <TextField
          label={t('Qty after approve', 'الكمية بعد الاعتماد')}
          type="number"
          min={0}
          step={0.0001}
          required
          value={qtyAfter}
          onChange={(e) => setQtyAfter(e.target.value)}
        />
        <Button
          type="submit"
          variant="brand"
          size="sm"
          loading={loading}
        >
          {t('Add line', 'إضافة بند')}
        </Button>
      </form>

      <BarcodeScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(text) => {
          setProductSearchCategory('barcode');
          setProductSearch(text.trim());
          setScanOpen(false);
        }}
        onCameraError={(msg) => toast.error(msg)}
      />
    </div>
  );
}
