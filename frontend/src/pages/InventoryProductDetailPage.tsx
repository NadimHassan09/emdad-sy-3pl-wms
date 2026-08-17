import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { Alert, Badge, Card, ListPageHeader, Skeleton } from '@ds';

import { InventoryApi, type LedgerRow, type StockRow } from '../api/inventory';
import { ProductsApi, type Product, type ProductUom } from '../api/products';
import { Column, DataTable } from '../components/DataTable';
import { FilterPanel } from '../components/FilterPanel';
import { SelectField } from '../components/SelectField';
import { TextField } from '../components/TextField';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';
import { useFilters } from '../hooks/useFilters';
import {
  fmtSignedDelta,
  ledgerEntryDetailPath,
  ledgerMovementCategory,
  ledgerMovementLabel,
  ledgerSignedChange,
} from '../lib/ledger-display';

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

type TabId = 'overview' | 'inventory' | 'locations' | 'lots' | 'logs' | 'movement';

const TABS: Array<{ id: TabId; en: string; ar: string }> = [
  { id: 'overview', en: 'Overview', ar: 'نظرة عامة' },
  { id: 'inventory', en: 'Inventory', ar: 'المخزون' },
  { id: 'locations', en: 'Locations', ar: 'المواقع' },
  { id: 'lots', en: 'Lots', ar: 'الدفعات' },
  { id: 'logs', en: 'Logs', ar: 'السجلات' },
  { id: 'movement', en: 'Stock Movement', ar: 'حركة المخزون' },
];

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

function MetricTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const bg =
    tone === 'success'
      ? 'bg-emerald-50 dark:bg-emerald-950/30'
      : tone === 'warning'
        ? 'bg-amber-50 dark:bg-amber-950/30'
        : tone === 'danger'
          ? 'bg-rose-50 dark:bg-rose-950/30'
          : tone === 'info'
            ? 'bg-sky-50 dark:bg-sky-950/30'
            : 'bg-slate-50 dark:bg-surface-sunken';
  return (
    <div className={`rounded-xl border border-transparent p-4 ${bg}`}>
      <div className="text-xs font-semibold text-text-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-text-strong">{value}</div>
    </div>
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
        <i className={`${iconClass} text-[11px] text-brand-600 dark:text-brand-400`} aria-hidden />
        <span>{label}</span>
      </div>
      <div className="mt-1.5 text-sm font-semibold text-text-strong">{value}</div>
    </div>
  );
}

function dayYmd(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function rangeFromPreset(preset: string): { from: string; to: string } {
  const to = dayYmd();
  const d = new Date(`${to}T00:00:00.000Z`);
  const days =
    preset === '7' ? 6 : preset === '30' ? 29 : preset === '90' ? 89 : preset === '365' ? 364 : 29;
  d.setUTCDate(d.getUTCDate() - days);
  return { from: d.toISOString().slice(0, 10), to };
}

function StockLevelChart({
  points,
}: {
  points: Array<{ day: string; balance: number }>;
}) {
  const w = 640;
  const h = 220;
  const pad = { t: 16, r: 16, b: 28, l: 44 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  if (points.length === 0) {
    return <p className="py-10 text-center text-sm text-text-muted">No stock history in this range.</p>;
  }
  const vals = points.map((p) => p.balance);
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  const span = max - min || 1;
  const xAt = (i: number) =>
    pad.l + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const yAt = (v: number) => pad.t + innerH - ((v - min) / span) * innerH;
  const line = points.map((p, i) => `${xAt(i)},${yAt(p.balance)}`).join(' ');
  const area = `${pad.l},${pad.t + innerH} ${line} ${xAt(points.length - 1)},${pad.t + innerH}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full max-w-full" role="img" aria-label="Stock over time">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const y = pad.t + innerH * (1 - f);
        return (
          <line key={f} x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
        );
      })}
      <polygon fill="rgba(22,163,74,0.12)" points={area} />
      <polyline fill="none" stroke="#16a34a" strokeWidth="2.5" points={line} />
      {points.length <= 14
        ? points.map((p, i) => (
            <text
              key={p.day}
              x={xAt(i)}
              y={h - 8}
              textAnchor="middle"
              fill="#64748b"
              style={{ fontSize: 9 }}
            >
              {p.day.slice(5)}
            </text>
          ))
        : [0, Math.floor((points.length - 1) / 2), points.length - 1].map((i) => (
            <text
              key={points[i]!.day}
              x={xAt(i)}
              y={h - 8}
              textAnchor="middle"
              fill="#64748b"
              style={{ fontSize: 9 }}
            >
              {points[i]!.day.slice(5)}
            </text>
          ))}
    </svg>
  );
}

function MovementQty({ row }: { row: LedgerRow }) {
  const n = ledgerSignedChange(row);
  const cat = ledgerMovementCategory(row.movementType);
  const color =
    cat === 'outbound' || n < 0
      ? 'text-rose-600 dark:text-rose-400'
      : cat === 'inbound' || cat === 'return' || n > 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-text-body';
  return (
    <span className={`font-mono font-semibold tabular-nums ${color}`}>
      {fmtSignedDelta(n)}
    </span>
  );
}

type MovementDraft = {
  movementType: '' | 'inbound' | 'outbound' | 'return';
  createdFrom: string;
  createdTo: string;
  referenceSearch: string;
  operatorSearch: string;
  lotNumber: string;
  locationId: string;
};

export function InventoryProductDetailPage() {
  const { productId = '' } = useParams<{ productId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { warehouseId: wid } = useDefaultWarehouseId();
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);

  const tabParam = searchParams.get('tab') as TabId | null;
  const activeTab: TabId = TABS.some((x) => x.id === tabParam) ? (tabParam as TabId) : 'overview';
  const setTab = (id: TabId) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    setSearchParams(next, { replace: true });
  };

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

  const quarantineQty = useMemo(() => {
    return stockRows
      .filter((r) => r.status === 'quarantined')
      .reduce((s, r) => s + Number(r.quantityOnHand || 0), 0);
  }, [stockRows]);

  const awaitingQty = useMemo(() => {
    return stockRows
      .filter((r) => r.status === 'awaiting_putaway')
      .reduce((s, r) => s + Number(r.quantityOnHand || 0), 0);
  }, [stockRows]);

  const lotSummary = useMemo(() => {
    const map = new Map<string, { lot: string; onHand: number; available: number }>();
    for (const r of stockRows) {
      const key = r.lot?.lotNumber ?? '—';
      const prev = map.get(key) ?? { lot: key, onHand: 0, available: 0 };
      prev.onHand += Number(r.quantityOnHand || 0);
      prev.available += r.status === 'available' ? Number(r.quantityAvailable || 0) : 0;
      map.set(key, prev);
    }
    return Array.from(map.values()).sort((a, b) => a.lot.localeCompare(b.lot));
  }, [stockRows]);

  const locationSummary = useMemo(() => {
    const map = new Map<string, { name: string; path: string; onHand: number; available: number }>();
    for (const r of stockRows) {
      const prev = map.get(r.locationId) ?? {
        name: r.location.name,
        path: r.location.fullPath,
        onHand: 0,
        available: 0,
      };
      prev.onHand += Number(r.quantityOnHand || 0);
      prev.available += r.status === 'available' ? Number(r.quantityAvailable || 0) : 0;
      map.set(r.locationId, prev);
    }
    return Array.from(map.values()).sort((a, b) => a.path.localeCompare(b.path));
  }, [stockRows]);

  const [chartPreset, setChartPreset] = useState('30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const chartRange = useMemo(() => {
    if (chartPreset === 'custom' && customFrom && customTo) {
      return { from: customFrom, to: customTo };
    }
    return rangeFromPreset(chartPreset === 'custom' ? '30' : chartPreset);
  }, [chartPreset, customFrom, customTo]);

  const balanceHistory = useQuery({
    queryKey: [
      'inventory',
      'balance-history',
      productId,
      wid || '',
      chartRange.from,
      chartRange.to,
    ],
    queryFn: () =>
      InventoryApi.balanceHistory({
        productId,
        warehouseId: wid || undefined,
        from: chartRange.from,
        to: chartRange.to,
      }),
    enabled: !!productId && !!wid && activeTab === 'movement',
  });

  const movementInitial = useMemo<MovementDraft>(
    () => ({
      movementType: '',
      createdFrom: '',
      createdTo: '',
      referenceSearch: '',
      operatorSearch: '',
      lotNumber: '',
      locationId: '',
    }),
    [],
  );
  const {
    draftFilters: mvDraft,
    appliedFilters: mvApplied,
    setDraft: setMvDraft,
    applyFilters: applyMv,
    resetFilters: resetMv,
  } = useFilters(movementInitial);

  const movementParams = useMemo(
    () => ({
      productId,
      warehouseId: wid || undefined,
      movementType: mvApplied.movementType || undefined,
      createdFrom: mvApplied.createdFrom.trim() || undefined,
      createdTo: mvApplied.createdTo.trim() || undefined,
      referenceSearch: mvApplied.referenceSearch.trim() || undefined,
      operatorSearch: mvApplied.operatorSearch.trim() || undefined,
      lotNumber: mvApplied.lotNumber.trim() || undefined,
      locationId: mvApplied.locationId.trim() || undefined,
      includeInternal: activeTab === 'logs' ? true : undefined,
    }),
    [productId, wid, mvApplied, activeTab],
  );

  const movementPagination = useChunkedServerPagination<LedgerRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: movementParams,
    fetchChunk: (offset, limit) => InventoryApi.ledger({ ...movementParams, offset, limit }),
    rtQueryKeyPrefix: ['inventory', 'ledger', productId],
    chunkQueryKeyPrefix: 'inventory-product-ledger-chunk',
    enabled: !!productId && !!wid && (activeTab === 'movement' || activeTab === 'logs'),
  });

  const locationColumns: Column<StockRow>[] = useMemo(
    () => [
      {
        header: t('Location', 'الموقع'),
        accessor: (r) => (
          <div>
            <div className="font-medium text-text-strong">{r.location.name}</div>
            <div className="font-mono text-xs text-text-muted">{r.location.fullPath}</div>
          </div>
        ),
      },
      {
        header: t('Lot', 'الدفعة'),
        accessor: (r) => (
          <span className="font-mono text-text-body">{r.lot?.lotNumber ?? '—'}</span>
        ),
        width: '140px',
      },
      {
        header: t('On hand', 'المتوفر'),
        accessor: (r) => (
          <span className="font-mono font-semibold tabular-nums">{fmtQty(r.quantityOnHand)}</span>
        ),
        width: '110px',
        className: 'text-right',
      },
      {
        header: t('Available', 'متاح'),
        accessor: (r) => (
          <span className="font-mono tabular-nums">
            {fmtQty(r.status === 'available' ? r.quantityAvailable : '0')}
          </span>
        ),
        width: '110px',
        className: 'text-right',
      },
      {
        header: t('Status', 'الحالة'),
        accessor: (r) => <StockStatusBadge status={r.status} isArabic={isArabic} />,
        width: '140px',
      },
    ],
    [isArabic],
  );

  const lotColumns: Column<(typeof lotSummary)[number]>[] = useMemo(
    () => [
      {
        header: t('Lot number', 'رقم الدفعة'),
        accessor: (r) => <span className="font-mono">{r.lot}</span>,
      },
      {
        header: t('On hand', 'المتوفر'),
        accessor: (r) => (
          <span className="font-mono font-semibold tabular-nums">{fmtQty(String(r.onHand))}</span>
        ),
        className: 'text-right',
      },
      {
        header: t('Available', 'متاح'),
        accessor: (r) => (
          <span className="font-mono font-bold tabular-nums">{fmtQty(String(r.available))}</span>
        ),
        className: 'text-right',
      },
    ],
    [isArabic],
  );

  const movementColumns: Column<LedgerRow>[] = useMemo(
    () => [
      {
        header: t('Date', 'التاريخ'),
        accessor: (r) => (
          <span className="text-xs text-text-muted">{new Date(r.createdAt).toLocaleString()}</span>
        ),
        width: '170px',
      },
      {
        header: t('Movement type', 'نوع الحركة'),
        accessor: (r) => {
          const cat = ledgerMovementCategory(r.movementType);
          const tone =
            cat === 'outbound'
              ? 'danger'
              : cat === 'inbound' || cat === 'return'
                ? 'success'
                : 'neutral';
          return (
            <Badge tone={tone} size="xs">
              {ledgerMovementLabel(cat)}
            </Badge>
          );
        },
        width: '120px',
      },
      {
        header: t('Reference', 'المرجع'),
        accessor: (r) => (
          <span className="font-mono text-xs text-text-body">
            {r.referenceType.replace(/_/g, ' ')}
          </span>
        ),
      },
      {
        header: t('Quantity', 'الكمية'),
        accessor: (r) => <MovementQty row={r} />,
        width: '110px',
        className: 'text-right',
      },
      {
        header: t('User', 'المستخدم'),
        accessor: (r) => r.operator.fullName,
        width: '140px',
      },
      {
        header: t('Order', 'الطلب'),
        accessor: (r) => (
          <span className="font-mono text-xs">{r.referenceId.slice(0, 8)}…</span>
        ),
        width: '100px',
      },
      {
        header: t('Client', 'العميل'),
        accessor: (r) => r.company.name,
        width: '140px',
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
        description={t(
          'The requested product could not be loaded.',
          'تعذّر تحميل المنتج المطلوب.',
        )}
      />
    );
  }

  const p = product.data;

  return (
    <div className="space-y-5 animate-enter">
      <div className="text-sm text-text-muted">
        <Link to="/inventory/stock" className="text-text-link hover:underline">
          ← {t('Back to inventory', 'العودة إلى المخزون')}
        </Link>
      </div>
      <ListPageHeader
        icon="fa-box"
        title={p.name}
        subtitle={`${p.sku}${p.company?.name ? ` · ${p.company.name}` : ''}`}
      />

      <nav
        className="flex flex-wrap gap-1 border-b border-border-subtle pb-px"
        aria-label={t('Product sections', 'أقسام المنتج')}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={`rounded-t-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? 'border-b-2 border-brand-600 text-brand-700 dark:text-brand-400'
                  : 'text-text-muted hover:text-text-strong'
              }`}
            >
              {isArabic ? tab.ar : tab.en}
            </button>
          );
        })}
      </nav>

      {activeTab === 'overview' ? (
        <Card padding="none" className="overflow-hidden">
          <Card.Body className="p-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <ProductDetailField
                iconClass="fa-solid fa-tag"
                label={t('Product', 'المنتج')}
                value={p.name}
              />
              <ProductDetailField
                iconClass="fa-solid fa-hashtag"
                label={t('SKU', 'رمز الصنف')}
                value={<span className="font-mono">{p.sku}</span>}
              />
              <ProductDetailField
                iconClass="fa-solid fa-building"
                label={t('Client', 'العميل')}
                value={p.company?.name ?? '—'}
              />
              <ProductDetailField
                iconClass="fa-solid fa-barcode"
                label={t('Barcode', 'الباركود')}
                value={
                  p.barcode ? <span className="font-mono">{p.barcode}</span> : '—'
                }
              />
              <ProductDetailField
                iconClass="fa-solid fa-scale-balanced"
                label={t('Unit of measure', 'وحدة القياس')}
                value={uomLabel(p.uom)}
              />
              <ProductDetailField
                iconClass="fa-solid fa-circle-check"
                label={t('Available stock', 'المخزون المتاح')}
                value={
                  <span className="font-mono text-lg font-bold tabular-nums">{totalAvailable}</span>
                }
              />
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
                onClick={() => setTab('movement')}
              >
                {t('View stock movement', 'عرض حركة المخزون')}
              </button>
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-strong hover:bg-surface-sunken"
                onClick={() => setTab('inventory')}
              >
                {t('Inventory details', 'تفاصيل المخزون')}
              </button>
            </div>
          </Card.Body>
        </Card>
      ) : null}

      {activeTab === 'inventory' ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MetricTile label={t('Available', 'متاح')} value={totalAvailable} tone="success" />
            <MetricTile label={t('Reserved', 'محجوز')} value={totalReserved} tone="warning" />
            <MetricTile label={t('On hand', 'المتوفر')} value={totalOnHand} tone="info" />
            <MetricTile
              label={t('Quarantine', 'الحجر')}
              value={fmtQty(String(quarantineQty))}
              tone="danger"
            />
            <MetricTile
              label={t('Awaiting putaway', 'بانتظار التخزين')}
              value={fmtQty(String(awaitingQty))}
              tone="neutral"
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card padding="md">
              <h3 className="mb-3 text-sm font-semibold text-text-strong">
                {t('Lot summary', 'ملخص الدفعات')}
              </h3>
              {lotSummary.length === 0 ? (
                <p className="text-sm text-text-muted">{t('No lots', 'لا توجد دفعات')}</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {lotSummary.slice(0, 8).map((l) => (
                    <li key={l.lot} className="flex justify-between gap-2">
                      <span className="font-mono text-text-body">{l.lot}</span>
                      <span className="font-mono font-semibold tabular-nums">
                        {fmtQty(String(l.available))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card padding="md">
              <h3 className="mb-3 text-sm font-semibold text-text-strong">
                {t('Location summary', 'ملخص المواقع')}
              </h3>
              {locationSummary.length === 0 ? (
                <p className="text-sm text-text-muted">{t('No locations', 'لا توجد مواقع')}</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {locationSummary.slice(0, 8).map((l) => (
                    <li key={l.path} className="flex justify-between gap-2">
                      <span className="truncate text-text-body" title={l.path}>
                        {l.name}
                      </span>
                      <span className="shrink-0 font-mono font-semibold tabular-nums">
                        {fmtQty(String(l.available))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      ) : null}

      {activeTab === 'locations' ? (
        <DataTable
          title={t('Locations', 'المواقع')}
          columns={locationColumns}
          rows={stockRows}
          rowKey={(r) => r.id}
          loading={stockPagination.isInitialLoading}
          empty={t('No stock rows for this product.', 'لا توجد صفوف مخزون لهذا المنتج.')}
          serverPagination={stockPagination.serverPagination}
        />
      ) : null}

      {activeTab === 'lots' ? (
        <DataTable
          title={t('Lots', 'الدفعات')}
          columns={lotColumns}
          rows={lotSummary}
          rowKey={(r) => r.lot}
          empty={t('No lots for this product.', 'لا توجد دفعات لهذا المنتج.')}
        />
      ) : null}

      {activeTab === 'logs' || activeTab === 'movement' ? (
        <div className="space-y-4">
          {activeTab === 'movement' ? (
            <Card padding="md">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-text-strong">
                  <i className="fa-solid fa-chart-line text-xs text-brand-600" aria-hidden />
                  {t('Stock over time', 'المخزون عبر الزمن')}
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <SelectField
                    label=""
                    name="chartPreset"
                    value={chartPreset}
                    onChange={(e) => setChartPreset(e.target.value)}
                    options={[
                      { value: '7', label: t('Last 7 days', 'آخر 7 أيام') },
                      { value: '30', label: t('Last 30 days', 'آخر 30 يوماً') },
                      { value: '90', label: t('Last 90 days', 'آخر 90 يوماً') },
                      { value: '365', label: t('Last year', 'آخر سنة') },
                      { value: 'custom', label: t('Custom range', 'نطاق مخصص') },
                    ]}
                  />
                  {chartPreset === 'custom' ? (
                    <>
                      <TextField
                        label={t('From', 'من')}
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                      />
                      <TextField
                        label={t('To', 'إلى')}
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                      />
                    </>
                  ) : null}
                </div>
              </div>
              {balanceHistory.isLoading ? (
                <Skeleton height={220} />
              ) : balanceHistory.isError ? (
                <Alert
                  variant="error"
                  title={t('Could not load chart', 'تعذّر تحميل المخطط')}
                />
              ) : (
                <StockLevelChart points={balanceHistory.data?.points ?? []} />
              )}
            </Card>
          ) : null}

          <FilterPanel
            title={t('Movement filters', 'فلاتر الحركة')}
            onApply={applyMv}
            onReset={resetMv}
            loading={movementPagination.isFetching}
            compact={
              <SelectField
                label={t('Movement type', 'نوع الحركة')}
                name="mvTypeCompact"
                value={mvDraft.movementType}
                onChange={(e) =>
                  setMvDraft({
                    movementType: e.target.value as MovementDraft['movementType'],
                  })
                }
                options={[
                  { value: '', label: t('All types', 'كل الأنواع') },
                  { value: 'inbound', label: t('Inbound', 'وارد') },
                  { value: 'outbound', label: t('Outbound', 'صادر') },
                  { value: 'return', label: t('Return', 'مرتجع') },
                ]}
              />
            }
            activeCount={[mvApplied.movementType, mvApplied.createdFrom, mvApplied.createdTo, mvApplied.referenceSearch, mvApplied.operatorSearch, mvApplied.lotNumber, mvApplied.locationId].filter((v) => String(v).trim()).length}
            advancedLabel={t('Advanced Filtering', 'تصفية متقدمة')}
            collapseLabel={t('Collapsed', 'إخفاء')}
      >
            <SelectField
              label={t('Movement type', 'نوع الحركة')}
              name="mvType"
              value={mvDraft.movementType}
              onChange={(e) =>
                setMvDraft({
                  movementType: e.target.value as MovementDraft['movementType'],
                })
              }
              options={[
                { value: '', label: t('All types', 'كل الأنواع') },
                { value: 'inbound', label: t('Inbound', 'وارد') },
                { value: 'outbound', label: t('Outbound', 'صادر') },
                { value: 'return', label: t('Return', 'مرتجع') },
              ]}
            />
            <TextField
              label={t('From date', 'من تاريخ')}
              type="date"
              value={mvDraft.createdFrom}
              onChange={(e) => setMvDraft({ createdFrom: e.target.value })}
            />
            <TextField
              label={t('To date', 'إلى تاريخ')}
              type="date"
              value={mvDraft.createdTo}
              onChange={(e) => setMvDraft({ createdTo: e.target.value })}
            />
            <TextField
              label={t('Order / reference', 'طلب / مرجع')}
              value={mvDraft.referenceSearch}
              onChange={(e) => setMvDraft({ referenceSearch: e.target.value })}
              placeholder={t('Order # or reference…', 'رقم الطلب أو المرجع…')}
            />
            <TextField
              label={t('User', 'المستخدم')}
              value={mvDraft.operatorSearch}
              onChange={(e) => setMvDraft({ operatorSearch: e.target.value })}
            />
            <TextField
              label={t('Lot', 'الدفعة')}
              value={mvDraft.lotNumber}
              onChange={(e) => setMvDraft({ lotNumber: e.target.value })}
            />
            <SelectField
              label={t('Location', 'الموقع')}
              name="mvLocation"
              value={mvDraft.locationId}
              onChange={(e) => setMvDraft({ locationId: e.target.value })}
              options={[
                { value: '', label: t('All locations', 'كل المواقع') },
                ...Array.from(
                  new Map(stockRows.map((r) => [r.locationId, r.location])).values(),
                ).map((loc) => ({
                  value: loc.id,
                  label: loc.name,
                })),
              ]}
            />
          </FilterPanel>

          <DataTable
            title={
              activeTab === 'logs'
                ? t('Internal logs', 'السجلات الداخلية')
                : t('Recent movements', 'أحدث الحركات')
            }
            columns={movementColumns}
            rows={movementPagination.rows}
            rowKey={(r) => `${r.id}:${r.createdAt}`}
            loading={movementPagination.isInitialLoading}
            empty={t('No movements match the filters.', 'لا توجد حركات مطابقة للفلاتر.')}
            onRowClick={(r) =>
              navigate(ledgerEntryDetailPath(r.id, r.createdAt, r.companyId))
            }
            serverPagination={movementPagination.serverPagination}
          />
        </div>
      ) : null}
    </div>
  );
}
