import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import { InventoryApi, StockRow } from '../api/inventory';
import { ProductsApi, type Product, type ProductUom } from '../api/products';
import { Column, DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';

const fmtQty = (s: string) => Number(s).toLocaleString(undefined, { maximumFractionDigits: 4 });

const UOM_LABELS: Record<ProductUom, string> = {
  piece: 'Piece',
  kg: 'Kilogram',
  litre: 'Litre',
  carton: 'Carton',
  pallet: 'Pallet',
  box: 'Box',
  roll: 'Roll',
};

function uomLabel(uom: ProductUom) {
  return UOM_LABELS[uom] ?? uom;
}

function ProductDetailField({
  iconClass,
  label,
  value,
}: {
  iconClass: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <i className={`${iconClass} text-[11px] text-brand-600/80`} aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="mt-1.5 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function ProductDetailsSummaryCard({
  product,
  totalOnHand,
  totalReserved,
  totalAvailable,
  t,
}: {
  product: Product;
  totalOnHand: string;
  totalReserved: string;
  totalAvailable: string;
  t: (en: string, ar: string) => string;
}) {
  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-50 ring-4 ring-slate-50"
          aria-hidden="true"
        >
          <i className="fa-solid fa-box text-xl text-slate-500" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="text-lg font-semibold leading-tight text-slate-900">
            {t('Product information', 'معلومات المنتج')}
          </h2>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <ProductDetailField
          iconClass="fa-solid fa-tag"
          label={t('Product', 'المنتج')}
          value={product.name}
        />
        <ProductDetailField
          iconClass="fa-solid fa-hashtag"
          label={t('SKU', 'رمز الصنف')}
          value={<span className="font-mono font-semibold">{product.sku}</span>}
        />
        <ProductDetailField
          iconClass="fa-solid fa-building"
          label={t('Client', 'العميل')}
          value={product.company?.name ?? '—'}
        />
        <ProductDetailField
          iconClass="fa-solid fa-barcode"
          label={t('Barcode', 'الباركود')}
          value={
            product.barcode ? (
              <span className="font-mono font-semibold">{product.barcode}</span>
            ) : (
              '—'
            )
          }
        />
        <ProductDetailField
          iconClass="fa-solid fa-scale-balanced"
          label={t('Unit of measure', 'وحدة القياس')}
          value={uomLabel(product.uom)}
        />
        <ProductDetailField
          iconClass="fa-solid fa-boxes-stacked"
          label={t('Total on hand', 'إجمالي المتوفر')}
          value={<span className="font-mono tabular-nums">{totalOnHand}</span>}
        />
        <ProductDetailField
          iconClass="fa-solid fa-lock"
          label={t('Reserved', 'محجوز')}
          value={<span className="font-mono tabular-nums">{totalReserved}</span>}
        />
        <ProductDetailField
          iconClass="fa-solid fa-circle-check"
          label={t('Available', 'متاح')}
          value={<span className="font-mono tabular-nums">{totalAvailable}</span>}
        />
      </div>
    </section>
  );
}

export function InventoryProductDetailPage() {
  const { productId = '' } = useParams<{ productId: string }>();
  const { warehouseId: wid } = useDefaultWarehouseId();
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);

  const product = useQuery({
    queryKey: [...QK.products, productId],
    queryFn: () => ProductsApi.get(productId),
    enabled: !!productId,
  });

  const stockFilterKey = useMemo(
    () => ({ productId, warehouseId: wid || '' }),
    [productId, wid],
  );

  const fetchStockChunk = useCallback(
    (offset: number, limit: number) =>
      InventoryApi.stock({
        productId,
        warehouseId: wid || undefined,
        offset,
        limit,
      }),
    [productId, wid],
  );

  // Server-computed totals over the FULL matching set — never truncated by
  // pagination — so the on-hand here matches the products catalog and grid.
  const stockTotals = useQuery({
    queryKey: [...QK.inventoryStock, 'totals', productId, wid || ''],
    queryFn: () =>
      InventoryApi.stock({ productId, warehouseId: wid || undefined, limit: 1, offset: 0 }),
    enabled: !!productId && !!wid,
    select: (res) => res.totals,
  });

  const stockPagination = useChunkedServerPagination<StockRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: stockFilterKey,
    fetchChunk: fetchStockChunk,
    rtQueryKeyPrefix: QK.inventoryStock,
    chunkQueryKeyPrefix: 'inventory-stock-chunk',
    enabled: !!productId && !!wid,
  });

  const stockRows = useMemo(() => {
    return stockPagination.rows.slice().sort((a, b) => {
      const lotA = a.lot?.lotNumber ?? '';
      const lotB = b.lot?.lotNumber ?? '';
      if (lotA !== lotB) return lotA.localeCompare(lotB);
      return a.location.fullPath.localeCompare(b.location.fullPath);
    });
  }, [stockPagination.rows]);

  const columns: Column<StockRow>[] = useMemo(
    () => [
      {
        header: t('Lot number', 'رقم الدفعة'),
        accessor: (r) => (
          <span className="font-mono text-slate-800">{r.lot?.lotNumber ?? '—'}</span>
        ),
        width: '180px',
      },
      {
        header: t('On hand', 'المتوفر'),
        accessor: (r) => (
          <span className="font-mono font-semibold text-slate-900">{fmtQty(r.quantityOnHand)}</span>
        ),
        width: '120px',
        className: 'text-right',
      },
      {
        header: t('Reserved', 'محجوز'),
        accessor: (r) => (
          <span className="font-mono text-slate-700">{fmtQty(r.quantityReserved)}</span>
        ),
        width: '110px',
        className: 'text-right',
      },
      {
        header: t('Available', 'متاح'),
        accessor: (r) => (
          <span className="font-mono text-slate-700">{fmtQty(r.quantityAvailable)}</span>
        ),
        width: '110px',
        className: 'text-right',
      },
      {
        header: t('Location name', 'اسم الموقع'),
        accessor: (r) => r.location.name,
      },
      {
        header: t('Location code', 'رمز الموقع'),
        accessor: (r) => <span className="font-mono text-xs text-slate-800">{r.location.barcode}</span>,
        width: '200px',
      },
    ],
    [isArabic],
  );

  const totalOnHand = fmtQty(stockTotals.data?.quantityOnHand ?? '0');
  const totalReserved = fmtQty(stockTotals.data?.quantityReserved ?? '0');
  const totalAvailable = fmtQty(stockTotals.data?.quantityAvailable ?? '0');

  if (!productId) return null;
  if (!wid) return <p className="text-sm text-slate-600">Resolve warehouse configuration…</p>;
  if (product.isLoading || stockPagination.isInitialLoading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }
  if (product.isError || !product.data)
    return <p className="text-sm text-rose-600">Product not found.</p>;

  const p = product.data;

  return (
    <>
      <div className="mb-2 text-sm text-slate-500">
        <Link to="/inventory/stock" className="hover:underline">
          ← {t('Back to inventory', 'العودة إلى المخزون')}
        </Link>
      </div>
      <PageHeader title={t('Product details', 'تفاصيل المنتج')} />

      <ProductDetailsSummaryCard
        product={p}
        totalOnHand={totalOnHand}
        totalReserved={totalReserved}
        totalAvailable={totalAvailable}
        t={t}
      />

      <DataTable
        title={t('Lot / location breakdown', 'تفصيل الدفعة / الموقع')}
        columns={columns}
        rows={stockRows}
        rowKey={(r) => r.id}
        loading={stockPagination.isInitialLoading}
        empty={t(
          'No stock rows for this product with current visibility.',
          'لا توجد صفوف مخزون لهذا المنتج ضمن الصلاحيات الحالية.',
        )}
        serverPagination={stockPagination.serverPagination}
        labels={{
          rowsSuffix: t('rows', 'صف'),
          resultsSuffix: t('results', 'نتيجة'),
          ofWord: t('of', 'من'),
          previous: t('Previous', 'السابق'),
          next: t('Next', 'التالي'),
          rowsPerPageAria: t('Rows per page', 'عدد الصفوف لكل صفحة'),
        }}
      />
    </>
  );
}
