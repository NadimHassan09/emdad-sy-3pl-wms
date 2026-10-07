import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Loader2 } from 'lucide-react'
import { formatDateTime, useUiPreferences } from '@emdad/core'
import { DataTable, PageHeader, ResetFiltersButton, useNavigate, cn } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Combobox } from '@emdad/ui/ui/combobox'
import { Checkbox } from '@emdad/ui/ui/checkbox'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { CompaniesApi } from '@/api/companies'
import { InventoryApi, type LedgerRow } from '@/api/inventory'
import { QK } from '@/constants/query-keys'
import { CHUNK_SIZE_STANDARD, useChunkedServerPagination } from '@/hooks/useChunkedServerPagination'
import { useDefaultWarehouseId } from '@/hooks/useDefaultWarehouse'
import { useFilters } from '@/hooks/useFilters'
import { companyFilterComboboxOptions } from '@/lib/company-filter-options'
import { fmtSignedDelta, ledgerEntryDetailPath, ledgerMovementCategory, ledgerMovementLabel, ledgerSignedChange } from '@/lib/ledger-display'
import { InventorySubNav } from './InventorySubNav'
import { MovementCategoryBadge } from './inventory-shared'

type LedgerSearchCategory = 'name' | 'sku' | 'barcode'

type LedgerDraft = {
  searchQuery: string
  searchCategory: LedgerSearchCategory
  movementType: '' | 'inbound' | 'outbound' | 'return'
  includeInternal: boolean
  companyId: string
  createdFrom: string
  createdTo: string
}

function ledgerSearchParams(filters: LedgerDraft, warehouseId: string | undefined) {
  const q = filters.searchQuery.trim()
  const base = {
    warehouseId: warehouseId || undefined,
    companyId: filters.companyId.trim() || undefined,
    movementType: filters.movementType || undefined,
    includeInternal: filters.includeInternal || undefined,
    createdFrom: filters.createdFrom.trim() || undefined,
    createdTo: filters.createdTo.trim() || undefined,
  }
  if (!q) return base
  switch (filters.searchCategory) {
    case 'name':
      return { ...base, productName: q }
    case 'sku':
      return { ...base, sku: q }
    case 'barcode':
      return { ...base, productBarcode: q }
    default:
      return base
  }
}

function ledgerRowKey(r: LedgerRow): string {
  return `${r.id}:${r.createdAt}`
}

export function InventoryLedgerPage() {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const { warehouseId } = useDefaultWarehouseId()

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
  )

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } = useFilters(initial)
  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
  })

  const clientFilterOptions = useMemo(
    () => companyFilterComboboxOptions(companies.data, t('All clients', 'كل العملاء')),
    [companies.data, isArabic], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const ledgerParams = useMemo(
    () => ledgerSearchParams(appliedFilters, warehouseId || undefined),
    [appliedFilters, warehouseId],
  )

  const pagination = useChunkedServerPagination<LedgerRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: ledgerParams,
    fetchChunk: (offset, limit) => InventoryApi.ledger({ ...ledgerParams, offset, limit }),
    rtQueryKeyPrefix: QK.ledger,
    chunkQueryKeyPrefix: 'ledger-chunk',
    enabled: !!warehouseId,
  })

  const columns = useMemo<ColumnDef<LedgerRow>[]>(
    () => [
      {
        id: 'product',
        header: t('Product', 'المنتج'),
        cell: ({ row }) => <span className="font-medium">{row.original.product.name}</span>,
        meta: { priority: 1, className: 'min-w-40' },
      },
      {
        id: 'sku',
        header: t('SKU', 'رمز الصنف'),
        cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.product.sku}</span>,
        meta: { priority: 2, className: 'min-w-28' },
      },
      {
        id: 'client',
        header: t('Client', 'العميل'),
        cell: ({ row }) => row.original.company.name,
        meta: { priority: 2, className: 'min-w-32' },
      },
      {
        id: 'movement',
        header: t('Movement type', 'نوع الحركة'),
        cell: ({ row }) => (
          <MovementCategoryBadge movementType={row.original.movementType} isArabic={isArabic} />
        ),
        meta: { priority: 1, className: 'min-w-28' },
      },
      {
        id: 'when',
        header: t('When', 'الوقت'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDateTime(row.original.createdAt, locale)}
          </span>
        ),
        meta: { priority: 1, className: 'min-w-36' },
      },
      {
        id: 'qty',
        header: t('Quantity', 'الكمية'),
        cell: ({ row }) => {
          const delta = ledgerSignedChange(row.original)
          const pos = delta > 0
          const neg = delta < 0
          return (
            <span
              className={cn(
                'font-mono font-semibold tabular-nums',
                pos ? 'text-emerald-600' : neg ? 'text-red-600' : '',
              )}
            >
              {fmtSignedDelta(delta)}
            </span>
          )
        },
        meta: { priority: 1, align: 'end', className: 'min-w-24' },
      },
    ],
    [isArabic, locale], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize))

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Inventory ledger', 'سجل المخزون')}
        description={t('Stock movements across products and locations.', 'حركات المخزون عبر المنتجات والمواقع.')}
      />
      <InventorySubNav />

      <section aria-label={t('Filters', 'التصفية')} className="space-y-3 rounded-xl border bg-card p-3">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            applyFilters()
          }}
        >
          <div className="min-w-48 flex-1 space-y-1.5">
            <Label htmlFor="ledger-search">{t('Search', 'بحث')}</Label>
            <Input
              id="ledger-search"
              value={draftFilters.searchQuery}
              onChange={(e) => setDraft({ searchQuery: e.target.value })}
              placeholder={t('Contains…', 'يحتوي على…')}
            />
          </div>
          <div className="min-w-36 space-y-1.5">
            <Label htmlFor="ledger-cat">{t('Search by', 'البحث حسب')}</Label>
            <Select
              value={draftFilters.searchCategory}
              onValueChange={(v) => setDraft({ searchCategory: v as LedgerSearchCategory })}
            >
              <SelectTrigger id="ledger-cat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">{t('Product name', 'اسم المنتج')}</SelectItem>
                <SelectItem value="sku">{t('SKU', 'رمز الصنف')}</SelectItem>
                <SelectItem value="barcode">{t('Barcode', 'الباركود')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-36 space-y-1.5">
            <Label htmlFor="ledger-mv">{t('Movement type', 'نوع الحركة')}</Label>
            <Select
              value={draftFilters.movementType || '__all__'}
              onValueChange={(v) =>
                setDraft({ movementType: (v === '__all__' ? '' : v) as LedgerDraft['movementType'] })
              }
            >
              <SelectTrigger id="ledger-mv">
                <SelectValue placeholder={t('All', 'الكل')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t('All (filtered)', 'الكل')}</SelectItem>
                <SelectItem value="inbound">{ledgerMovementLabel('inbound', isArabic)}</SelectItem>
                <SelectItem value="outbound">{ledgerMovementLabel('outbound', isArabic)}</SelectItem>
                <SelectItem value="return">{ledgerMovementLabel('return', isArabic)}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-48 space-y-1.5">
            <Label>{t('Client', 'العميل')}</Label>
            <Combobox
              value={draftFilters.companyId}
              onChange={(v) => setDraft({ companyId: v })}
              options={clientFilterOptions}
              placeholder={t('All clients', 'كل العملاء')}
            />
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Checkbox
              id="ledger-internal"
              checked={draftFilters.includeInternal}
              onCheckedChange={(c) => setDraft({ includeInternal: c === true })}
            />
            <Label htmlFor="ledger-internal" className="text-sm font-normal leading-snug">
              {t('Show internal operations', 'إظهار العمليات الداخلية')}
            </Label>
          </div>
          <div className="min-w-36 space-y-1.5">
            <Label htmlFor="ledger-from">{t('Created from', 'من')}</Label>
            <Input
              id="ledger-from"
              type="date"
              value={draftFilters.createdFrom}
              onChange={(e) => setDraft({ createdFrom: e.target.value })}
            />
          </div>
          <div className="min-w-36 space-y-1.5">
            <Label htmlFor="ledger-to">{t('Created to', 'إلى')}</Label>
            <Input
              id="ledger-to"
              type="date"
              value={draftFilters.createdTo}
              onChange={(e) => setDraft({ createdTo: e.target.value })}
            />
          </div>
          <div className="ms-auto flex items-center gap-2 pb-0.5">
            <ResetFiltersButton label={t('Reset', 'إعادة تعيين')} onClick={resetFilters} />
            <Button type="submit" disabled={pagination.isFetching || !warehouseId}>
              {pagination.isFetching ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {t('Apply', 'تطبيق')}
            </Button>
          </div>
        </form>
      </section>

      {pagination.total > 0 ? (
        <p className="text-sm text-muted-foreground">
          {t(
            `${pagination.total} movement(s) · page ${pagination.page} of ${totalPages}`,
            `${pagination.total} حركة · صفحة ${pagination.page} من ${totalPages}`,
          )}
        </p>
      ) : null}

      <DataTable<LedgerRow>
        columns={columns}
        data={pagination.rows}
        getRowId={ledgerRowKey}
        loading={pagination.isInitialLoading || !warehouseId}
        empty={warehouseId ? t('No ledger rows for the current filters.', 'لا توجد حركات مطابقة.') : t('Warehouse not resolved.', 'لم يُحدد المستودع.')}
        onRowClick={(r) => navigate(ledgerEntryDetailPath(r.id, r.createdAt, r.companyId))}
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
