import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import { InventoryApi, StockRow } from '../api/inventory';
import { ProductsApi, type Product, type ProductUom } from '../api/products';
import { Column, DataTable } from '../components/DataTable';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';
import { Alert, Badge, Card, ListPageHeader, Skeleton } from '@ds';

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

function StockStatusBadge({ status, isArabic }: { status: StockRow['status']; isArabic: boolean }) {
  const map: Record<
    StockRow['status'],
    { en: string; ar: string; tone: 'success' | 'warning' | 'info' }
  > = {
    available: { en: 'Available', ar: 'متاح', tone: 'success' },
    quarantined: { en: 'Quarantined', ar: 'حجر', tone: 'warning' },
    awaiting_putaway: {
      en: 'Awaiting putaway',
      ar: 'بانتظار التخزين',
      tone: 'info',
    },
  };
  const cfg = map[status] ?? map.available;
  return (
    <Badge tone={cfg.tone} size="xs">
      {isArabic ? cfg.ar : cfg.en}
    </Badge>
  );
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
      <div className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
        <i className={`${iconClass} text-[11px] text-brand-600 dark:text-brand-400`} aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="mt-1.5 text-sm font-semibold text-text-strong">{value}</div>
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
    <Card padding="none" className="mb-6 overflow-hidden">
      <Card.Body className="p-6">
        <div className="flex items-start gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-surface-card-muted text-text-muted"
            aria-hidden="true"
          >
            <i className="fa-solid fa-box text-xl" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="text-lg font-semibold leading-tight text-text-strong">
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
      </Card.Body>
    </Card>
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
          <span className="font-mono text-text-body">{r.lot?.lotNumber ?? '—'}</span>
        ),
        width: '180px',
      },
      {
        header: t('On hand', 'المتوفر'),
        accessor: (r) => (
          <span className="font-mono font-semibold text-text-strong">{fmtQty(r.quantityOnHand)}</span>
        ),
        width: '120px',
        className: 'text-right',
      },
      {
        header: t('Reserved', 'محجوز'),
        accessor: (r) => (
          <span className="font-mono text-text-body">{fmtQty(r.quantityReserved)}</span>
        ),
        width: '110px',
        className: 'text-right',
      },
      {
        header: t('Available', 'متاح'),
        accessor: (r) => (
          <span className="font-mono text-text-body">
            {fmtQty(r.status === 'available' ? r.quantityAvailable : '0')}
          </span>
        ),
        width: '110px',
        className: 'text-right',
      },
      {
        header: t('Status', 'الحالة'),
        accessor: (r) => <StockStatusBadge status={r.status} isArabic={isArabic} />,
        width: '160px',
      },
      {
        header: t('Location name', 'اسم الموقع'),
        accessor: (r) => r.location.name,
      },
      {
        header: t('Location code', 'رمز الموقع'),
        accessor: (r) => <span className="font-mono text-xs text-text-body">{r.location.barcode}</span>,
        width: '200px',
      },
    ],
    [isArabic],
  );

  const totalOnHand = fmtQty(stockTotals.data?.quantityOnHand ?? '0');
  const totalReserved = fmtQty(stockTotals.data?.quantityReserved ?? '0');
  const totalAvailable = fmtQty(stockTotals.data?.quantityAvailable ?? '0');

  if (!productId) return null;
  if (!wid) {
    return (
      <Alert
        variant="warning"
        title={t('Warehouse not configured', 'المستودع غير محدد')}
        description={t('Resolve warehouse configuration…', 'يلزم تهيئة المستودع…')}
      />
    );
  }
  if (product.isLoading || stockPagination.isInitialLoading) {
    return (
      <div className="space-y-4">
        <Skeleton height={28} width="40%" />
        <Card padding="md">
          <Skeleton height={120} />
        </Card>
        <Skeleton height={240} />
      </div>
    );
  }
  if (product.isError || !product.data) {
    return (
      <Alert
        variant="error"
        title={t('Product not found', 'المنتج غير موجود')}
        description={t('The requested product could not be loaded.', 'تعذّر تحميل المنتج المطلوب.')}
      />
    );
  }

  const p = product.data;

  return (
    <>
      <div className="mb-2 text-sm text-text-muted">
        <Link to="/inventory/stock" className="text-text-link hover:underline">
          ← {t('Back to inventory', 'العودة إلى المخزون')}
        </Link>
      </div>
      <ListPageHeader
        icon="fa-box"
        title={t('Product details', 'تفاصيل المنتج')}
        subtitle={p.sku}
      />

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
