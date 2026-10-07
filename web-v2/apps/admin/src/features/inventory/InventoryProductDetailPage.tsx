import { useCallback, useMemo, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeft } from 'lucide-react'
import { formatDateTime, useUiPreferences } from '@emdad/core'
import { DataTable, ErrorState, PageHeader, useNavigate } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@emdad/ui/ui/card'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@emdad/ui/ui/tabs'
import { InventoryApi, type LedgerRow, type StockRow } from '@/api/inventory'
import { ProductsApi } from '@/api/products'
import { QK } from '@/constants/query-keys'
import { CHUNK_SIZE_STANDARD, useChunkedServerPagination } from '@/hooks/useChunkedServerPagination'
import { useDefaultWarehouseId } from '@/hooks/useDefaultWarehouse'
import { useFilters } from '@/hooks/useFilters'
import { ledgerEntryDetailPath } from '@/lib/ledger-display'
import {
  fmtQty,
  MovementCategoryBadge,
  MovementQtyCell,
  StockStatusBadge,
  uomLabel,
} from './inventory-shared'

type TabId = 'overview' | 'inventory' | 'locations' | 'lots' | 'logs' | 'movement'

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value ?? '—'}</div>
    </div>
  )
}

type MovementDraft = {
  movementType: '' | 'inbound' | 'outbound' | 'return'
  createdFrom: string
  createdTo: string
}

export function InventoryProductDetailPage() {
  const { productId = '' } = useParams<{ productId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const { warehouseId } = useDefaultWarehouseId()

  const tabParam = searchParams.get('tab') as TabId | null
  const activeTab: TabId =
    tabParam && ['overview', 'inventory', 'locations', 'lots', 'logs', 'movement'].includes(tabParam)
      ? tabParam
      : 'overview'

  const setTab = (id: TabId) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', id)
    setSearchParams(next, { replace: true })
  }

  const product = useQuery({
    queryKey: [...QK.products, productId],
    queryFn: () => ProductsApi.get(productId),
    enabled: !!productId,
  })

  const stockFilterKey = useMemo(() => ({ productId, warehouseId: warehouseId || '' }), [productId, warehouseId])

  const fetchStockChunk = useCallback(
    (offset: number, limit: number) =>
      InventoryApi.stock({
        productId,
        warehouseId: warehouseId || undefined,
        offset,
        limit,
      }),
    [productId, warehouseId],
  )

  const stockTotals = useQuery({
    queryKey: [...QK.inventoryStock, 'totals', productId, warehouseId || ''],
    queryFn: () => InventoryApi.stock({ productId, warehouseId: warehouseId || undefined, limit: 1, offset: 0 }),
    enabled: !!productId && !!warehouseId,
    select: (res) => res.totals,
  })

  const stockPagination = useChunkedServerPagination<StockRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: stockFilterKey,
    fetchChunk: fetchStockChunk,
    rtQueryKeyPrefix: QK.inventoryStock,
    chunkQueryKeyPrefix: 'inventory-stock-chunk',
    enabled: !!productId && !!warehouseId,
  })

  const stockRows = useMemo(
    () =>
      stockPagination.rows.slice().sort((a, b) => {
        const lotA = a.lot?.lotNumber ?? ''
        const lotB = b.lot?.lotNumber ?? ''
        if (lotA !== lotB) return lotA.localeCompare(lotB)
        return a.location.fullPath.localeCompare(b.location.fullPath)
      }),
    [stockPagination.rows],
  )

  const lotSummary = useMemo(() => {
    const map = new Map<string, { lot: string; onHand: number; available: number }>()
    for (const r of stockRows) {
      const key = r.lot?.lotNumber ?? '—'
      const prev = map.get(key) ?? { lot: key, onHand: 0, available: 0 }
      prev.onHand += Number(r.quantityOnHand || 0)
      prev.available += r.status === 'available' ? Number(r.quantityAvailable || 0) : 0
      map.set(key, prev)
    }
    return Array.from(map.values()).sort((a, b) => a.lot.localeCompare(b.lot))
  }, [stockRows])

  const locationSummary = useMemo(() => {
    const map = new Map<string, { name: string; path: string; onHand: number; available: number }>()
    for (const r of stockRows) {
      const prev = map.get(r.locationId) ?? {
        name: r.location.name,
        path: r.location.fullPath,
        onHand: 0,
        available: 0,
      }
      prev.onHand += Number(r.quantityOnHand || 0)
      prev.available += r.status === 'available' ? Number(r.quantityAvailable || 0) : 0
      map.set(r.locationId, prev)
    }
    return Array.from(map.values()).sort((a, b) => a.path.localeCompare(b.path))
  }, [stockRows])

  const movementInitial = useMemo<MovementDraft>(
    () => ({ movementType: '', createdFrom: '', createdTo: '' }),
    [],
  )
  const { appliedFilters: mvApplied } = useFilters(movementInitial)

  const movementParams = useMemo(
    () => ({
      productId,
      warehouseId: warehouseId || undefined,
      movementType: mvApplied.movementType || undefined,
      createdFrom: mvApplied.createdFrom.trim() || undefined,
      createdTo: mvApplied.createdTo.trim() || undefined,
      includeInternal: activeTab === 'logs' ? true : undefined,
    }),
    [productId, warehouseId, mvApplied, activeTab],
  )

  const movementPagination = useChunkedServerPagination<LedgerRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: movementParams,
    fetchChunk: (offset, limit) => InventoryApi.ledger({ ...movementParams, offset, limit }),
    rtQueryKeyPrefix: ['inventory', 'ledger', productId],
    chunkQueryKeyPrefix: 'inventory-product-ledger-chunk',
    enabled: !!productId && !!warehouseId && (activeTab === 'movement' || activeTab === 'logs'),
  })

  const stockColumns = useMemo<ColumnDef<StockRow>[]>(
    () => [
      {
        id: 'location',
        header: t('Location', 'الموقع'),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.location.name}</div>
            <div className="font-mono text-xs text-muted-foreground">{row.original.location.fullPath}</div>
          </div>
        ),
        meta: { priority: 1, className: 'min-w-48' },
      },
      {
        id: 'lot',
        header: t('Lot', 'الدفعة'),
        cell: ({ row }) => <span className="font-mono text-sm">{row.original.lot?.lotNumber ?? '—'}</span>,
        meta: { priority: 2, className: 'min-w-28' },
      },
      {
        id: 'onHand',
        header: t('On hand', 'المتوفر'),
        cell: ({ row }) => (
          <span className="font-mono font-semibold tabular-nums">{fmtQty(row.original.quantityOnHand)}</span>
        ),
        meta: { priority: 1, align: 'end', className: 'min-w-24' },
      },
      {
        id: 'available',
        header: t('Available', 'متاح'),
        cell: ({ row }) => (
          <span className="font-mono tabular-nums">
            {fmtQty(row.original.status === 'available' ? row.original.quantityAvailable : '0')}
          </span>
        ),
        meta: { priority: 1, align: 'end', className: 'min-w-24' },
      },
      {
        id: 'status',
        header: t('Status', 'الحالة'),
        cell: ({ row }) => <StockStatusBadge status={row.original.status} isArabic={isArabic} />,
        meta: { priority: 2, className: 'min-w-32' },
      },
    ],
    [isArabic], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const ledgerColumns = useMemo<ColumnDef<LedgerRow>[]>(
    () => [
      {
        id: 'when',
        header: t('Date', 'التاريخ'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{formatDateTime(row.original.createdAt, locale)}</span>
        ),
        meta: { priority: 1, className: 'min-w-36' },
      },
      {
        id: 'movement',
        header: t('Movement type', 'نوع الحركة'),
        cell: ({ row }) => <MovementCategoryBadge movementType={row.original.movementType} isArabic={isArabic} />,
        meta: { priority: 1, className: 'min-w-28' },
      },
      {
        id: 'qty',
        header: t('Quantity', 'الكمية'),
        cell: ({ row }) => <MovementQtyCell row={row.original} />,
        meta: { priority: 1, align: 'end', className: 'min-w-24' },
      },
      {
        id: 'operator',
        header: t('User', 'المستخدم'),
        cell: ({ row }) => row.original.operator.fullName,
        meta: { priority: 2, className: 'min-w-32' },
      },
    ],
    [isArabic, locale], // eslint-disable-line react-hooks/exhaustive-deps
  )

  if (!productId) return null

  if (!warehouseId) {
    return (
      <Alert>
        <AlertTitle>{t('Warehouse not configured', 'المستودع غير محدد')}</AlertTitle>
        <AlertDescription>{t('Resolve warehouse configuration…', 'يلزم تهيئة المستودع…')}</AlertDescription>
      </Alert>
    )
  }

  if (product.isLoading || stockPagination.isInitialLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (product.isError || !product.data) {
    return <ErrorState title={t('Product not found', 'المنتج غير موجود')} />
  }

  const p = product.data
  const totalAvailable = fmtQty(stockTotals.data?.quantityAvailable ?? '0')
  const totalOnHand = fmtQty(stockTotals.data?.quantityOnHand ?? '0')
  const totalReserved = fmtQty(stockTotals.data?.quantityReserved ?? '0')

  return (
    <div className="space-y-4">
      <Button type="button" variant="ghost" size="sm" className="-ms-2" asChild>
        <Link to="/inventory/stock">
          <ArrowLeft aria-hidden />
          {t('Back to inventory', 'العودة إلى المخزون')}
        </Link>
      </Button>

      <PageHeader
        title={p.name}
        description={`${p.sku}${p.company?.name ? ` · ${p.company.name}` : ''}`}
      />

      <Tabs value={activeTab} onValueChange={(v) => setTab(v as TabId)}>
        <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
          {(
            [
              ['overview', t('Overview', 'نظرة عامة')],
              ['inventory', t('Inventory', 'المخزون')],
              ['locations', t('Locations', 'المواقع')],
              ['lots', t('Lots', 'الدفعات')],
              ['logs', t('Logs', 'السجلات')],
              ['movement', t('Stock movement', 'حركة المخزون')],
            ] as const
          ).map(([id, label]) => (
            <TabsTrigger key={id} value={id} className="data-[state=active]:bg-muted">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('Product details', 'تفاصيل المنتج')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label={t('SKU', 'رمز الصنف')} value={<span className="font-mono">{p.sku}</span>} />
              <DetailField label={t('Client', 'العميل')} value={p.company?.name} />
              <DetailField label={t('Barcode', 'الباركود')} value={p.barcode ? <span className="font-mono">{p.barcode}</span> : '—'} />
              <DetailField label={t('Unit of measure', 'وحدة القياس')} value={uomLabel(p.uom, isArabic)} />
              <DetailField label={t('On hand', 'المتوفر')} value={<span className="font-mono text-lg">{totalOnHand}</span>} />
              <DetailField label={t('Reserved', 'محجوز')} value={<span className="font-mono">{totalReserved}</span>} />
              <DetailField label={t('Available stock', 'المخزون المتاح')} value={<span className="font-mono text-lg">{totalAvailable}</span>} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="mt-4">
          <DataTable<StockRow>
            columns={stockColumns}
            data={stockRows}
            getRowId={(r) => r.id}
            loading={stockPagination.isInitialLoading}
            empty={t('No stock rows for this product.', 'لا توجد بنود مخزون.')}
            pagination={{
              page: stockPagination.page,
              pageSize: stockPagination.pageSize,
              total: stockPagination.total,
              onPageChange: stockPagination.setPage,
              onPageSizeChange: () => stockPagination.resetPage(),
            }}
            labels={{ noResults: t('No results', 'لا نتائج') }}
          />
        </TabsContent>

        <TabsContent value="locations" className="mt-4">
          <DataTable
            columns={[
              {
                id: 'path',
                header: t('Location', 'الموقع'),
                cell: ({ row }) => (
                  <div>
                    <div className="font-medium">{row.original.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{row.original.path}</div>
                  </div>
                ),
                meta: { priority: 1 },
              },
              {
                id: 'onHand',
                header: t('On hand', 'المتوفر'),
                cell: ({ row }) => fmtQty(String(row.original.onHand)),
                meta: { priority: 1, align: 'end' },
              },
              {
                id: 'avail',
                header: t('Available', 'متاح'),
                cell: ({ row }) => fmtQty(String(row.original.available)),
                meta: { priority: 1, align: 'end' },
              },
            ]}
            data={locationSummary}
            getRowId={(r) => r.path}
            empty={t('No locations.', 'لا مواقع.')}
            labels={{ noResults: t('No results', 'لا نتائج') }}
          />
        </TabsContent>

        <TabsContent value="lots" className="mt-4">
          <DataTable
            columns={[
              {
                id: 'lot',
                header: t('Lot number', 'رقم الدفعة'),
                cell: ({ row }) => <span className="font-mono">{row.original.lot}</span>,
                meta: { priority: 1 },
              },
              {
                id: 'onHand',
                header: t('On hand', 'المتوفر'),
                cell: ({ row }) => fmtQty(String(row.original.onHand)),
                meta: { priority: 1, align: 'end' },
              },
              {
                id: 'avail',
                header: t('Available', 'متاح'),
                cell: ({ row }) => fmtQty(String(row.original.available)),
                meta: { priority: 1, align: 'end' },
              },
            ]}
            data={lotSummary}
            getRowId={(r) => r.lot}
            empty={t('No lots.', 'لا دفعات.')}
            labels={{ noResults: t('No results', 'لا نتائج') }}
          />
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <DataTable<LedgerRow>
            columns={ledgerColumns}
            data={movementPagination.rows}
            getRowId={(r) => `${r.id}:${r.createdAt}`}
            loading={movementPagination.isInitialLoading}
            empty={t('No log entries.', 'لا سجلات.')}
            onRowClick={(r) => navigate(ledgerEntryDetailPath(r.id, r.createdAt, r.companyId))}
            pagination={{
              page: movementPagination.page,
              pageSize: movementPagination.pageSize,
              total: movementPagination.total,
              onPageChange: movementPagination.setPage,
              onPageSizeChange: () => movementPagination.resetPage(),
            }}
            labels={{ noResults: t('No results', 'لا نتائج') }}
          />
        </TabsContent>

        <TabsContent value="movement" className="mt-4">
          <DataTable<LedgerRow>
            columns={ledgerColumns}
            data={movementPagination.rows}
            getRowId={(r) => `${r.id}:${r.createdAt}`}
            loading={movementPagination.isInitialLoading}
            empty={t('No movements in this range.', 'لا حركات.')}
            onRowClick={(r) => navigate(ledgerEntryDetailPath(r.id, r.createdAt, r.companyId))}
            pagination={{
              page: movementPagination.page,
              pageSize: movementPagination.pageSize,
              total: movementPagination.total,
              onPageChange: movementPagination.setPage,
              onPageSizeChange: () => movementPagination.resetPage(),
            }}
            labels={{ noResults: t('No results', 'لا نتائج') }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
