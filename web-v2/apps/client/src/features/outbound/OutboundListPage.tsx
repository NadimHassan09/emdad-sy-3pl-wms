import { useEffect, useMemo, useState } from 'react'
import type { ColumnDef, OnChangeFn, RowSelectionState } from '@tanstack/react-table'
import { toast } from 'sonner'
import { Download, Loader2, Package, Plus, Upload } from 'lucide-react'
import { formatDate, formatDateTime, useUiPreferences } from '@emdad/core'
import {
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  ResetFiltersButton,
  SearchInput,
  useNavigate,
} from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { WmsSectionTabs } from '@/features/_shared/WmsSectionTabs'
import { CHUNK_SIZE_STANDARD, useChunkedServerPagination } from '@/hooks/useChunkedServerPagination'
import { useClientOperationalAccess } from '@/hooks/useClientOperationalAccess'
import { useFilters } from '@/hooks/useFilters'
import { isProductionClientPortal } from '@/lib/production-client-portal'
import {
  fetchClientOutboundOrders,
  type ClientOutboundOrderRow,
} from '@/services/clientOutboundOrdersService'
import {
  CLIENT_OUTBOUND_EXPORT_COLUMNS,
  downloadClientOrdersExport,
} from '@/services/clientOrdersExport'
import { OutboundExportDialog } from './OutboundExportDialog'
import { OutboundImportDialog } from './OutboundImportDialog'
import { OutboundStatusBadge } from './outbound-ui'

type ListFilters = { search: string; status: string }

const DEFAULTS: ListFilters = { search: '', status: '' }

const STATUS_OPTIONS = [
  { value: '__all__', en: 'All statuses', ar: 'كل الحالات' },
  { value: 'pending_approval', en: 'Waiting for approval', ar: 'بانتظار الموافقة' },
  { value: 'in_progress', en: 'In progress', ar: 'قيد التنفيذ' },
  { value: 'shipped', en: 'Shipped', ar: 'تم الشحن' },
  { value: 'cancelled', en: 'Cancelled', ar: 'ملغي' },
] as const

export function OutboundListPage() {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const billing = useClientOperationalAccess(isArabic)

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters<ListFilters>(DEFAULTS)

  const draft = useMemo(() => ({ ...DEFAULTS, ...draftFilters }), [draftFilters])
  const applied = useMemo(() => ({ ...DEFAULTS, ...appliedFilters }), [appliedFilters])

  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  const hideImportUi = isProductionClientPortal()
  const allowExportUi = !isProductionClientPortal()

  const filterKey = useMemo(
    () => ({
      orderSearch: applied.search.trim() || undefined,
      status: applied.status && applied.status !== '__all__' ? applied.status : undefined,
    }),
    [applied],
  )

  const pagination = useChunkedServerPagination<ClientOutboundOrderRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey,
    fetchChunk: (offset, limit) => fetchClientOutboundOrders({ ...filterKey, offset, limit }),
    rtQueryKeyPrefix: ['client', 'outbound-orders'],
    chunkQueryKeyPrefix: 'client-outbound-orders-chunk',
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

  const onExportSubmit = async (payload: { columnIds: string[]; arabicHeaders: boolean }) => {
    if (exporting) return
    setExporting(true)
    setExportError(null)
    try {
      const ids = selectedIds.size > 0 ? [...selectedIds] : undefined
      await downloadClientOrdersExport('outbound', {
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

  const hasFilters = Boolean(applied.search.trim()) || Boolean(applied.status && applied.status !== '__all__')

  const columns = useMemo<ColumnDef<ClientOutboundOrderRow>[]>(
    () => [
      {
        id: 'orderNumber',
        header: t('Order #', 'رقم الطلب'),
        cell: ({ row }) => (
          <span className="font-mono text-sm font-semibold">
            {row.original.orderNumber || row.original.id.slice(0, 8)}
          </span>
        ),
        meta: { priority: 1, className: 'min-w-32' },
      },
      {
        id: 'status',
        header: t('Status', 'الحالة'),
        cell: ({ row }) => <OutboundStatusBadge status={row.original.status} isArabic={isArabic} />,
        meta: { priority: 1, className: 'min-w-36' },
      },
      {
        id: 'recipient',
        header: t('Recipient', 'المستلم'),
        cell: ({ row }) => row.original.recipientName?.trim() || '—',
        meta: { priority: 2, className: 'min-w-32' },
      },
      {
        id: 'requiredShip',
        header: t('Required Ship', 'الشحن المطلوب'),
        cell: ({ row }) =>
          row.original.requiredShipDate
            ? formatDate(row.original.requiredShipDate, locale)
            : '—',
        meta: { priority: 2, className: 'min-w-28' },
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
        meta: { priority: 3, align: 'end', className: 'min-w-36' },
      },
    ],
    [isArabic, locale], // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Outbound Orders', 'طلبات الصادر')}
        description={t('Warehouse shipments', 'شحنات المستودع')}
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
              onClick={() => navigate('/outbound-orders/new')}
            >
              <Plus aria-hidden />
              {t('New outbound', 'صادر جديد')}
            </Button>
          </>
        }
      />

      <WmsSectionTabs isArabic={isArabic} />

      {!hideImportUi ? (
        <OutboundImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImported={() => void pagination.refetch()}
          isArabic={isArabic}
          disabled={!billing.operationalAllowed}
          disabledReason={billing.actionBlockedReason}
        />
      ) : null}

      {allowExportUi ? (
        <OutboundExportDialog
          open={exportOpen}
          onClose={() => !exporting && setExportOpen(false)}
          columns={CLIENT_OUTBOUND_EXPORT_COLUMNS}
          exporting={exporting}
          onExport={(p) => void onExportSubmit(p)}
          isArabic={isArabic}
          errorMessage={exportError}
        />
      ) : null}

      <section aria-label={t('Filters', 'التصفية')} className="space-y-3 rounded-xl border bg-card p-3">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            applyFilters()
          }}
        >
          <div className="min-w-48 flex-1 space-y-1.5">
            <Label className="text-sm">{t('Order #', 'رقم الطلب')}</Label>
            <SearchInput
              value={draft.search}
              onChange={(v) => setDraft({ search: v })}
              placeholder={t('Search order number…', 'ابحث برقم الطلب…')}
            />
          </div>
          <div className="min-w-44 space-y-1.5">
            <Label className="text-sm">{t('Status', 'الحالة')}</Label>
            <Select
              value={draft.status || '__all__'}
              onValueChange={(v) => setDraft({ status: v === '__all__' ? '' : v })}
            >
              <SelectTrigger className="min-h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {isArabic ? o.ar : o.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={pagination.isFetching}>
            {t('Apply', 'تطبيق')}
          </Button>
          <ResetFiltersButton
            label={t('Reset', 'إعادة تعيين')}
            onClick={() => resetFilters()}
            disabled={!hasFilters && !draft.search && !draft.status}
          />
        </form>
      </section>

      {allowExportUi && selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {t(`${selectedIds.size} selected`, `${selectedIds.size} طلب محدد`)}
          </p>
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
            {t('Export selected', 'تصدير المحدد')}
          </Button>
        </div>
      ) : null}

      <DataTable<ClientOutboundOrderRow>
        columns={columns}
        data={pagination.rows}
        getRowId={(r) => r.id}
        loading={pagination.isInitialLoading}
        rowSelection={allowExportUi ? rowSelection : undefined}
        onRowSelectionChange={allowExportUi ? onRowSelectionChange : undefined}
        onRowClick={(row) => navigate(`/outbound-orders/${row.id}`)}
        stateOverride={
          pagination.isError ? (
            <ErrorState
              title={t('Could not load outbound orders', 'تعذر تحميل طلبات الصادر')}
              description={(pagination.error as Error)?.message}
              retryLabel={t('Retry', 'إعادة المحاولة')}
              onRetry={() => void pagination.refetch()}
            />
          ) : undefined
        }
        empty={
          <EmptyState
            icon={Package}
            title={
              hasFilters
                ? t('No outbound orders match the filters.', 'لا توجد طلبات صادر مطابقة للفلاتر.')
                : t('No outbound orders found.', 'لا توجد طلبات صادر.')
            }
            action={
              !hasFilters && billing.operationalAllowed ? (
                <Button type="button" onClick={() => navigate('/outbound-orders/new')}>
                  <Plus aria-hidden />
                  {t('New outbound', 'صادر جديد')}
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
          onPageSizeChange: () => undefined,
        }}
        labels={{
          rowsPerPage: t('Rows per page', 'صفوف الصفحة'),
          of: t('of', 'من'),
          noResults: t('No results', 'لا نتائج'),
          select: t('Select order', 'اختر الطلب'),
          selectAll: t('Select all on this page', 'تحديد الكل في هذه الصفحة'),
        }}
      />
    </div>
  )
}
