import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Loader2 } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { DataTable, PageHeader, ResetFiltersButton, useNavigate, cn } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Combobox } from '@emdad/ui/ui/combobox'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { CompaniesApi } from '@/api/companies'
import { InventoryApi, type ProductStockSummaryRow } from '@/api/inventory'
import { QK } from '@/constants/query-keys'
import { CHUNK_SIZE_STANDARD, useChunkedServerPagination } from '@/hooks/useChunkedServerPagination'
import { useDefaultWarehouseId } from '@/hooks/useDefaultWarehouse'
import { useFilters } from '@/hooks/useFilters'
import { companyFilterComboboxOptions } from '@/lib/company-filter-options'
import { InventorySubNav } from './InventorySubNav'
import { fmtQty, LastMovementCell, uomLabel } from './inventory-shared'

type InventorySearchCategory = 'name' | 'sku' | 'barcode' | 'lotNumber' | 'inboundOrderNumber'

type InvDraftFilters = {
  companyId: string
  searchCategory: InventorySearchCategory
  searchQuery: string
}

function inventorySearchParams(filters: InvDraftFilters, warehouseId: string | undefined) {
  const q = filters.searchQuery.trim()
  const base = {
    warehouseId: warehouseId || undefined,
    companyId: filters.companyId.trim() || undefined,
  }
  if (!q) return base
  switch (filters.searchCategory) {
    case 'name':
      return { ...base, productName: q }
    case 'sku':
      return { ...base, sku: q }
    case 'barcode':
      return { ...base, productBarcode: q }
    case 'lotNumber':
      return { ...base, lotNumber: q }
    case 'inboundOrderNumber':
      return { ...base, inboundOrderNumber: q }
    default:
      return base
  }
}

export function InventoryStockPage() {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const { warehouseId } = useDefaultWarehouseId()

  const initialInvFilters = useMemo<InvDraftFilters>(
    () => ({ companyId: '', searchCategory: 'name', searchQuery: '' }),
    [],
  )

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } = useFilters(initialInvFilters)

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
  })

  const clientOptions = useMemo(
    () => companyFilterComboboxOptions(companies.data, t('All clients', 'كل العملاء')),
    [companies.data, isArabic], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const summaryParams = useMemo(
    () => inventorySearchParams(appliedFilters, warehouseId || undefined),
    [appliedFilters, warehouseId],
  )

  const pagination = useChunkedServerPagination<ProductStockSummaryRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: summaryParams,
    fetchChunk: (offset, limit) => InventoryApi.stockByProductSummary({ ...summaryParams, offset, limit }),
    rtQueryKeyPrefix: QK.inventoryStockByProduct,
    chunkQueryKeyPrefix: 'inventory-stock-by-product-chunk',
    enabled: !!warehouseId,
  })

  const searchCategoryOptions = useMemo(
    () => [
      { value: 'name', label: t('Product name', 'اسم المنتج') },
      { value: 'sku', label: t('SKU', 'رمز الصنف') },
      { value: 'barcode', label: t('Barcode', 'الباركود') },
      { value: 'lotNumber', label: t('Lot number', 'رقم الدفعة') },
      { value: 'inboundOrderNumber', label: t('Inbound order number', 'رقم طلب الوارد') },
    ],
    [isArabic], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const columns = useMemo<ColumnDef<ProductStockSummaryRow>[]>(
    () => [
      {
        id: 'product',
        header: t('Product', 'المنتج'),
        cell: ({ row }) => <span className="font-medium">{row.original.product.name}</span>,
        meta: { priority: 1, className: 'min-w-48' },
      },
      {
        id: 'client',
        header: t('Client', 'العميل'),
        cell: ({ row }) => row.original.client.name,
        meta: { priority: 2, className: 'min-w-32' },
      },
      {
        id: 'sku',
        header: t('SKU', 'رمز الصنف'),
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.product.sku}</span>,
        meta: { priority: 1, className: 'min-w-28' },
      },
      {
        id: 'available',
        header: t('Available stock', 'المخزون المتاح'),
        cell: ({ row }) => (
          <span className="block text-end font-mono text-sm font-bold tabular-nums">
            {fmtQty(row.original.available ?? '0')}
          </span>
        ),
        meta: { priority: 1, align: 'end', className: 'min-w-28' },
      },
      {
        id: 'lastMovement',
        header: t('Last movement', 'آخر حركة'),
        cell: ({ row }) => <LastMovementCell row={row.original} isArabic={isArabic} />,
        meta: { priority: 3, className: 'min-w-28' },
      },
      {
        id: 'uom',
        header: t('Unit', 'الوحدة'),
        cell: ({ row }) => uomLabel(row.original.product.uom, isArabic),
        meta: { priority: 3, className: 'min-w-24' },
      },
    ],
    [isArabic], // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Inventory', 'المخزون')}
        description={t(
          'Browse products and open details for stock history.',
          'تصفح المنتجات وافتح التفاصيل لسجل المخزون.',
        )}
      />
      <InventorySubNav />

      {!warehouseId ? (
        <Alert>
          <AlertTitle>{t('Warehouse not configured', 'المستودع غير محدد')}</AlertTitle>
          <AlertDescription>
            {t(
              'No default warehouse is set. Contact your administrator.',
              'لم يتم تحديد مستودع افتراضي. تواصل مع المسؤول.',
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      <section aria-label={t('Filters', 'التصفية')} className="space-y-3 rounded-xl border bg-card p-3">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            applyFilters()
          }}
        >
          <div className="min-w-48 flex-1 space-y-1.5">
            <Label htmlFor="inv-search">{t('Search', 'بحث')}</Label>
            <Input
              id="inv-search"
              value={draftFilters.searchQuery}
              onChange={(e) => setDraft({ searchQuery: e.target.value })}
              placeholder={t('Contains…', 'يحتوي على…')}
              className={draftFilters.searchCategory !== 'name' ? 'font-mono' : undefined}
            />
          </div>
          <div className="min-w-40 space-y-1.5">
            <Label htmlFor="inv-search-by">{t('Search by', 'البحث حسب')}</Label>
            <Select
              value={draftFilters.searchCategory}
              onValueChange={(v) => setDraft({ searchCategory: v as InventorySearchCategory })}
            >
              <SelectTrigger id="inv-search-by" className="w-full min-w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {searchCategoryOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-48 space-y-1.5">
            <Label>{t('Client', 'العميل')}</Label>
            <Combobox
              value={draftFilters.companyId}
              onChange={(v) => setDraft({ companyId: v })}
              options={clientOptions}
              placeholder={t('All clients', 'كل العملاء')}
            />
          </div>
          <div className="ms-auto flex items-center gap-2 pb-0.5">
            <ResetFiltersButton label={t('Reset', 'إعادة تعيين')} onClick={resetFilters} />
            <Button type="submit" disabled={pagination.isFetching}>
              {pagination.isFetching ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {t('Apply', 'تطبيق')}
            </Button>
          </div>
        </form>
      </section>

      {pagination.total > 0 ? (
        <p className="text-sm text-muted-foreground">
          {t(
            `${pagination.total} product(s) with stock`,
            `${pagination.total} منتج(ات) بمخزون`,
          )}
        </p>
      ) : null}

      <DataTable<ProductStockSummaryRow>
        columns={columns}
        data={pagination.rows}
        getRowId={(r) => r.productId}
        loading={pagination.isInitialLoading || !warehouseId}
        stateOverride={
          pagination.isError ? (
            <div
              role="alert"
              className={cn('rounded-xl border border-tone-danger-border bg-tone-danger-bg p-4 text-sm text-tone-danger-fg')}
            >
              {(pagination.error as Error)?.message || t('Failed to load inventory.', 'فشل تحميل المخزون.')}
            </div>
          ) : !warehouseId ? (
            <p className="text-sm text-muted-foreground">{t('Warehouse not resolved yet.', 'لم يُحدد المستودع بعد.')}</p>
          ) : undefined
        }
        empty={t('No on-hand stock matches the current filters.', 'لا يوجد مخزون مطابق للتصفية.')}
        onRowClick={(r) => navigate(`/inventory/product/${r.productId}`)}
        pagination={{
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onPageChange: pagination.setPage,
          onPageSizeChange: () => pagination.resetPage(),
        }}
        labels={{
          rowsPerPage: t('Rows per page', 'عدد الصفوف في الصفحة'),
          of: t('of', 'من'),
          noResults: t('No results', 'لا نتائج'),
        }}
      />
    </div>
  )
}
