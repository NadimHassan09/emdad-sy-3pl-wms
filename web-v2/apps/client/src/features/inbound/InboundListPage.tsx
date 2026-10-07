import { useEffect, useMemo, useState } from 'react'
import type { ColumnDef, OnChangeFn, RowSelectionState } from '@tanstack/react-table'
import { toast } from 'sonner'
import { ArrowDownToLine, Download, Loader2, Plus, Upload, X } from 'lucide-react'
import { formatDate, formatDateTime, useUiPreferences } from '@emdad/core'
import {
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  ResetFiltersButton,
  SearchInput,
  useNavigate,
  cn,
} from '@emdad/ui'
import { Badge } from '@emdad/ui/ui/badge'
import { Button } from '@emdad/ui/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { WmsSectionTabs } from '@/features/_shared/WmsSectionTabs'
import { CHUNK_SIZE_STANDARD, useChunkedServerPagination } from '@/hooks/useChunkedServerPagination'
import { useClientOperationalAccess } from '@/hooks/useClientOperationalAccess'
import { useFilters } from '@/hooks/useFilters'
import { isProductionClientPortal } from '@/lib/production-client-portal'
import {
  fetchClientInboundOrders,
  type ClientInboundOrderRow,
} from '@/services/clientInboundOrdersService'
import {
  CLIENT_INBOUND_EXPORT_COLUMNS,
  downloadClientOrdersExport,
} from '@/services/clientOrdersExport'
import { InboundExportDialog } from './InboundExportDialog'
import { InboundImportDialog } from './InboundImportDialog'
import { InboundStatusBadge } from './inbound-ui'

type ListFilters = { search: string; status: string }

const DEFAULTS: ListFilters = { search: '', status: '' }

const STATUS_OPTIONS = [
  { value: 'pending_approval', en: 'Waiting for approval', ar: 'بانتظار الموافقة' },
  { value: 'in_progress', en: 'In progress', ar: 'قيد التنفيذ' },
  { value: 'completed', en: 'Completed', ar: 'مكتمل' },
  { value: 'cancelled', en: 'Cancelled', ar: 'ملغي' },
] as const

const ALL = '__all__'

export function InboundListPage() {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const billing = useClientOperationalAccess(isArabic)
  const hideImportUi = isProductionClientPortal()
  const allowExportUi = !isProductionClientPortal()

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters<ListFilters>(DEFAULTS)

  const draft = useMemo(() => ({ ...DEFAULTS, ...draftFilters }), [draftFilters])
  const applied = useMemo(() => ({ ...DEFAULTS, ...appliedFilters }), [appliedFilters])

  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  const filterKey = useMemo(
    () => ({
      orderSearch: applied.search.trim() || undefined,
      status: applied.status || undefined,
    }),
    [applied],
  )

  const pagination = useChunkedServerPagination<ClientInboundOrderRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey,
    fetchChunk: (offset, limit) => fetchClientInboundOrders({ ...filterKey, offset, limit }),
    rtQueryKeyPrefix: ['client', 'inbound-orders'],
    chunkQueryKeyPrefix: 'client-inbound-orders-chunk',
  })

  useEffect(() => {
    setSelectedIds(new Set())
  }, [filterKey.orderSearch, filterKey.status, pagination.page])

  const rowSelection = useMemo<RowSelectionState>(
    () => Object.fromEntries([...selectedIds].map((id) => [id, true])),
    [selectedIds],
  )
  const onRowSelectionChange: OnChangeFn<RowSelectionState> = (updater) => {
    const next = typeof updater === 'function' ? updater(rowSelection) : updater
    setSelectedIds(new Set(Object.keys(next).filter((k) => next[k])))
  }

  const hasFilters = Boolean(applied.search.trim()) || Boolean(applied.status.trim())

  const onExportSubmit = async (payload: { columnIds: string[]; arabicHeaders: boolean }) => {
    if (exporting) return
    setExporting(true)
    setExportError(null)
    try {
      const ids = selectedIds.size > 0 ? [...selectedIds] : undefined
      await downloadClientOrdersExport('inbound', {
        ...payload,
        ids,
        orderSearch: ids ? undefined : filterKey.orderSearch,
        status: ids ? undefined : filterKey.status,
      })
      setExportOpen(false)
      toast.success(t('Exported to CSV.', 'تم تنزيل ملف CSV.'))
    } catch (e) {
      setExportError(e instanceof Error ? e.message : t('Export failed.', 'فشل التصدير.'))
    } finally {
      setExporting(false)
    }
  }

  const columns = useMemo<ColumnDef<ClientInboundOrderRow>[]>(
    () => [
      {
        id: 'orderNumber',
        header: t('Order #', 'رقم الطلب'),
        cell: ({ row }) => (
          <span className="font-mono text-sm font-semibold">
            {row.original.orderNumber || '—'}
          </span>
        ),
        meta: { priority: 1, className: 'min-w-32' },
      },
      {
        id: 'status',
        header: t('Status', 'الحالة'),
        cell: ({ row }) => (
          <InboundStatusBadge status={row.original.status} isArabic={isArabic} />
        ),
        meta: { priority: 1, className: 'min-w-36' },
      },
      {
        id: 'expectedArrival',
        header: t('Expected Arrival', 'الوصول المتوقع'),
        cell: ({ row }) => formatDate(row.original.expectedArrivalDate, locale),
        meta: { priority: 2, className: 'min-w-32' },
      },
      {
        id: 'lines',
        header: t('Lines', 'البنود'),
        cell: ({ row }) => row.original._count?.lines ?? 0,
        meta: { priority: 2, align: 'end', className: 'min-w-20 tabular' },
      },
      {
        id: 'created',
        header: t('Created', 'تاريخ الإنشاء'),
        cell: ({ row }) => (
          <span className="tabular text-sm text-muted-foreground">
            {formatDateTime(row.original.createdAt, locale)}
          </span>
        ),
        meta: { priority: 2, align: 'end', className: 'min-w-36' },
      },
    ],
    [isArabic, locale], // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Inbound Orders', 'طلبات الوارد')}
        description={t('Warehouse receipts', 'إيصالات المستودع')}
        actions={
          <>
            {allowExportUi ? (
              <Button
                type="button"
                variant="outline"
                disabled={exporting}
                onClick={() => {
                  setExportError(null)
                  setExportOpen(true)
                }}
              >
                {exporting ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
                {t('Export', 'تصدير')}
              </Button>
            ) : null}
            {!hideImportUi ? (
              <Button
                type="button"
                variant="outline"
                disabled={!billing.operationalAllowed}
                title={billing.operationalAllowed ? undefined : billing.actionBlockedReason}
                onClick={() => setImportOpen(true)}
              >
                <Upload aria-hidden />
                {t('Import', 'استيراد')}
              </Button>
            ) : null}
            <Button
              type="button"
              disabled={!billing.operationalAllowed}
              title={billing.operationalAllowed ? undefined : billing.actionBlockedReason}
              onClick={() => navigate('/inbound-orders/new')}
            >
              <Plus aria-hidden />
              {t('New inbound', 'وارد جديد')}
            </Button>
          </>
        }
      />

      <WmsSectionTabs isArabic={isArabic} />

      {!hideImportUi ? (
        <InboundImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImported={() => void pagination.refetch()}
          isArabic={isArabic}
          disabled={!billing.operationalAllowed}
          disabledReason={billing.actionBlockedReason}
        />
      ) : null}

      {allowExportUi ? (
        <InboundExportDialog
          open={exportOpen}
          onClose={() => !exporting && setExportOpen(false)}
          columns={CLIENT_INBOUND_EXPORT_COLUMNS}
          exporting={exporting}
          onExport={(p) => void onExportSubmit(p)}
          isArabic={isArabic}
          errorMessage={exportError}
        />
      ) : null}

      <section aria-label={t('Filters', 'التصفية')} className="space-y-3 rounded-xl border bg-card p-3">
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            applyFilters()
          }}
        >
          <SearchInput
            value={draft.search}
            onChange={(v) => setDraft({ search: v })}
            placeholder={t('Search order number…', 'ابحث برقم الطلب…')}
            className="min-w-48 flex-1"
          />
          <Select
            value={draft.status || ALL}
            onValueChange={(v) => setDraft({ status: v === ALL ? '' : v })}
          >
            <SelectTrigger className="w-48" aria-label={t('All statuses', 'كل الحالات')}>
              <SelectValue placeholder={t('All statuses', 'كل الحالات')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('All statuses', 'كل الحالات')}</SelectItem>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {isArabic ? o.ar : o.en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" disabled={pagination.isFetching}>
            {t('Apply', 'تطبيق')}
          </Button>
          <ResetFiltersButton label={t('Reset', 'إعادة تعيين')} onClick={() => resetFilters()} />
        </form>
      </section>

      {allowExportUi && selectedIds.size > 0 ? (
        <FilterBar
          className={cn('items-center gap-2 rounded-xl border border-primary/30 bg-secondary p-2')}
        >
          <span className="px-2 text-sm font-medium">
            <Badge className="me-2 tabular">{selectedIds.size}</Badge>
            {t('selected', 'محدد')}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={exporting}
            onClick={() => {
              setExportError(null)
              setExportOpen(true)
            }}
          >
            <Download aria-hidden />
            {t('Export', 'تصدير')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ms-auto"
            onClick={() => setSelectedIds(new Set())}
          >
            <X aria-hidden />
            {t('Clear selection', 'إلغاء التحديد')}
          </Button>
        </FilterBar>
      ) : null}

      <DataTable<ClientInboundOrderRow>
        columns={columns}
        data={pagination.rows}
        getRowId={(r) => r.id}
        loading={pagination.isInitialLoading}
        rowSelection={allowExportUi ? rowSelection : undefined}
        onRowSelectionChange={allowExportUi ? onRowSelectionChange : undefined}
        onRowClick={(row) => navigate(`/inbound-orders/${row.id}`)}
        stateOverride={
          pagination.isError ? (
            <ErrorState
              title={t('Could not load inbound orders', 'تعذر تحميل طلبات الوارد')}
              retryLabel={t('Retry', 'إعادة المحاولة')}
              onRetry={() => void pagination.refetch()}
            />
          ) : undefined
        }
        empty={
          <EmptyState
            icon={ArrowDownToLine}
            title={
              hasFilters
                ? t('No inbound orders match the filters.', 'لا توجد طلبات وارد مطابقة للفلاتر.')
                : t('No inbound orders found.', 'لا توجد طلبات وارد.')
            }
            description={
              hasFilters
                ? undefined
                : t('Create a warehouse receipt request to get started.', 'أنشئ طلب إيصال وارد للبدء.')
            }
            action={
              !hasFilters && billing.operationalAllowed ? (
                <Button type="button" onClick={() => navigate('/inbound-orders/new')}>
                  <Plus aria-hidden />
                  {t('New inbound', 'وارد جديد')}
                </Button>
              ) : undefined
            }
          />
        }
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
