import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Download, Loader2, MoreHorizontal, Plus, SlidersHorizontal, Upload } from 'lucide-react'
import { formatDate, useUiPreferences } from '@emdad/core'
import {
  ConfirmDialog,
  DataTable,
  EmptyState,
  PageHeader,
  ResetFiltersButton,
  SearchInput,
  useNavigate,
} from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Badge } from '@emdad/ui/ui/badge'
import { Button } from '@emdad/ui/ui/button'
import { Combobox } from '@emdad/ui/ui/combobox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@emdad/ui/ui/dropdown-menu'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { InboundApi, type InboundOrder, type InboundOrderStatus } from '@/api/inbound'
import { CompaniesApi } from '@/api/companies'
import { useAuth } from '@/auth/AuthContext'
import { QK } from '@/constants/query-keys'
import { useCachedState } from '@/hooks/useCachedState'
import { CHUNK_SIZE_STANDARD, useChunkedServerPagination } from '@/hooks/useChunkedServerPagination'
import { useDefaultWarehouseId } from '@/hooks/useDefaultWarehouse'
import { useFilters } from '@/hooks/useFilters'
import { companyFilterComboboxOptions } from '@/lib/company-filter-options'
import {
  buildInboundListParams,
  countAppliedInboundAdvancedFilters,
  INBOUND_LIST_FILTER_DEFAULTS,
  type InboundListFilterState,
} from '@/lib/inbound-list-params'
import { inboundHasQuantityShortfall } from '@/lib/inbound-shortfall'
import { invalidateWorkflowTasksInventory } from '@/lib/invalidate-wms-queries'
import { canAccessInternalTransfer } from '@/lib/rbac'
import { InboundExportDialog, type InboundExportColumnOption } from './InboundExportDialog'
import { InboundImportDialog } from './InboundImportDialog'
import { InboundStatusBadge } from './inbound-ui'

type RowAction = { key: string; label: string; onClick: () => void; destructive?: boolean }

const STATUS_OPTIONS: { value: string; en: string; ar: string }[] = [
  { value: '', en: 'All statuses', ar: 'كل الحالات' },
  { value: 'draft', en: 'Draft', ar: 'مسودة' },
  { value: 'pending_approval', en: 'Pending approval', ar: 'بانتظار الموافقة' },
  { value: 'confirmed', en: 'Confirmed', ar: 'مؤكد' },
  { value: 'in_progress', en: 'In progress', ar: 'قيد التنفيذ' },
  { value: 'partially_received', en: 'Partially received', ar: 'مستلم جزئياً' },
  { value: 'completed', en: 'Completed', ar: 'مكتمل' },
  { value: 'cancelled', en: 'Cancelled', ar: 'ملغي' },
]

export function InboundListPage() {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const isAdmin = canAccessInternalTransfer(user?.role)

  const { warehouseId: defaultWid, warehouses } = useDefaultWarehouseId()
  const [searchParams] = useSearchParams()

  const [toCancel, setToCancel] = useState<InboundOrder | null>(null)
  const [toDelete, setToDelete] = useState<InboundOrder | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportColumns, setExportColumns] = useState<InboundExportColumnOption[]>([])
  const [exporting, setExporting] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useCachedState('inbound-orders:advanced-open', false)

  const { draftFilters, appliedFilters, setDraft, applyPatch, applyFilters, resetFilters } =
    useFilters<InboundListFilterState>(INBOUND_LIST_FILTER_DEFAULTS)

  useEffect(() => {
    const status = searchParams.get('status') ?? ''
    if (status && status !== appliedFilters.status) {
      applyPatch({ status })
    }
  }, [searchParams, appliedFilters.status, applyPatch])

  const companiesQuery = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
  })

  const clientOptions = useMemo(
    () => companyFilterComboboxOptions(companiesQuery.data, t('All clients', 'كل العملاء')),
    [companiesQuery.data, isArabic], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const warehouseOptions = useMemo(
    () => [
      { value: '', label: t('All warehouses', 'كل المستودعات') },
      ...warehouses
        .filter((w) => w.status === 'active')
        .map((w) => ({ value: w.id, label: `${w.name} (${w.code})` })),
    ],
    [warehouses, isArabic], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const listParams = useMemo(
    () => buildInboundListParams(appliedFilters, defaultWid),
    [appliedFilters, defaultWid],
  )

  const effectiveWid = listParams.warehouseId

  const pagination = useChunkedServerPagination<InboundOrder>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: listParams,
    fetchChunk: (offset, limit) => InboundApi.list({ ...listParams, offset, limit }),
    rtQueryKeyPrefix: QK.inboundOrders,
    chunkQueryKeyPrefix: 'inbound-orders-chunk',
    enabled: !!effectiveWid,
  })

  const advancedActive = countAppliedInboundAdvancedFilters(appliedFilters)

  const cancelMut = useMutation({
    mutationFn: (orderId: string) => InboundApi.cancel(orderId),
    onSuccess: (_data, orderId) => {
      toast.success(t('Order cancelled.', 'تم إلغاء الطلب.'))
      setToCancel(null)
      void qc.invalidateQueries({ queryKey: QK.inboundOrders })
      invalidateWorkflowTasksInventory(qc, { referenceId: orderId, referenceType: 'inbound_order' })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMut = useMutation({
    mutationFn: (orderId: string) => InboundApi.remove(orderId),
    onSuccess: () => {
      toast.success(t('Order deleted.', 'تم حذف الطلب.'))
      setToDelete(null)
      void qc.invalidateQueries({ queryKey: QK.inboundOrders })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const rowActions = (o: InboundOrder): RowAction[] => {
    const actions: RowAction[] = [
      {
        key: 'open',
        label: t('Open details', 'فتح التفاصيل'),
        onClick: () => navigate(`/orders/inbound/${o.id}`),
      },
    ]
    const hasReceived = (o.lines ?? []).some((l) => Number(l.receivedQuantity) > 0)
    const canEditPlan =
      o.status === 'draft' ||
      o.status === 'pending_approval' ||
      ((o.status === 'confirmed' || o.status === 'in_progress') && !hasReceived)
    if (canEditPlan) {
      actions.push({
        key: 'edit',
        label: t('Edit', 'تعديل'),
        onClick: () => navigate(`/orders/inbound/${o.id}/edit`),
      })
    }
    if (o.status !== 'completed' && o.status !== 'cancelled') {
      actions.push({
        key: 'cancel',
        label: t('Cancel order', 'إلغاء الطلب'),
        destructive: true,
        onClick: () => setToCancel(o),
      })
    }
    if (isAdmin && o.status === 'cancelled') {
      actions.push({
        key: 'delete',
        label: t('Delete', 'حذف'),
        destructive: true,
        onClick: () => setToDelete(o),
      })
    }
    return actions
  }

  useEffect(() => {
    void InboundApi.exportColumns().then(setExportColumns).catch(() => setExportColumns([]))
  }, [])

  const onExportSubmit = async (payload: { columnIds: string[]; arabicHeaders: boolean }) => {
    if (exporting) return
    setExporting(true)
    try {
      await InboundApi.exportDownloadPost({ ...listParams, ...payload })
      setExportOpen(false)
      toast.success(t('Exported to CSV.', 'تم تنزيل ملف CSV.'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Export failed.', 'فشل التصدير.'))
    } finally {
      setExporting(false)
    }
  }

  const columns = useMemo<ColumnDef<InboundOrder>[]>(
    () => [
      {
        id: 'orderNumber',
        header: t('Order #', 'رقم الطلب'),
        cell: ({ row }) => <span className="font-mono text-sm">{row.original.orderNumber || '—'}</span>,
        meta: { priority: 1, className: 'min-w-36' },
      },
      {
        id: 'client',
        header: t('Client', 'العميل'),
        cell: ({ row }) => (
          <span className="text-sm font-medium">{row.original.company?.name?.trim() || '—'}</span>
        ),
        meta: { priority: 2, className: 'min-w-40' },
      },
      {
        id: 'status',
        header: t('Status', 'الحالة'),
        cell: ({ row }) => {
          const o = row.original
          return (
            <div className="flex flex-col items-start gap-0.5">
              <InboundStatusBadge status={o.status as InboundOrderStatus} isArabic={isArabic} />
              {inboundHasQuantityShortfall(o) &&
              (o.status === 'completed' || o.status === 'partially_received') ? (
                <span className="text-xs text-tone-warning-fg">{t('Missing quantities', 'كميات ناقصة')}</span>
              ) : null}
            </div>
          )
        },
        meta: { priority: 1, className: 'w-0 whitespace-nowrap' },
      },
      {
        id: 'expectedArrival',
        header: t('Expected arrival', 'تاريخ الوصول المتوقع'),
        cell: ({ row }) => (
          <span className="text-sm tabular">{formatDate(row.original.expectedArrivalDate, locale)}</span>
        ),
        meta: { priority: 3, className: 'min-w-32' },
      },
      {
        id: 'lines',
        header: t('Lines', 'البنود'),
        cell: ({ row }) => (
          <span className="text-sm tabular">{row.original._count?.lines ?? row.original.lines?.length ?? 0}</span>
        ),
        meta: { priority: 3, align: 'end', className: 'min-w-16' },
      },
      {
        id: 'created',
        header: t('Created at', 'تاريخ الإنشاء'),
        cell: ({ row }) => (
          <span className="text-sm tabular whitespace-nowrap">
            {formatDate(row.original.createdAt, locale, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            })}
          </span>
        ),
        meta: { priority: 3, className: 'min-w-44' },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('Actions', 'الإجراءات')}</span>,
        cell: ({ row }) => {
          const items = rowActions(row.original)
          return (
            <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" aria-label={t('Open actions', 'فتح الإجراءات')}>
                    <MoreHorizontal aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-48">
                  {items.map((a, i) => (
                    <div key={a.key}>
                      {a.destructive && i > 0 && !items[i - 1]?.destructive ? <DropdownMenuSeparator /> : null}
                      <DropdownMenuItem variant={a.destructive ? 'destructive' : 'default'} className="min-h-10" onSelect={a.onClick}>
                        {a.label}
                      </DropdownMenuItem>
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
        meta: { priority: 1, align: 'end', className: 'w-14', cardAction: true },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isArabic, locale, isAdmin],
  )

  const hasActiveFilters = Boolean(
    appliedFilters.orderSearch.trim() ||
      appliedFilters.status.trim() ||
      appliedFilters.createdFrom.trim() ||
      appliedFilters.createdTo.trim() ||
      appliedFilters.companyId.trim() ||
      appliedFilters.warehouseId.trim(),
  )

  const field = (label: string, node: React.ReactNode, id?: string) => (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {node}
    </div>
  )

  const emptyNode = !effectiveWid ? (
    t('Warehouse not resolved yet.', 'لم يتم تحديد المستودع بعد.')
  ) : hasActiveFilters ? (
    t('No inbound orders match the filters.', 'لا توجد طلبات وارد مطابقة للفلاتر.')
  ) : (
    <EmptyState
      title={t('No inbound orders yet', 'لا توجد طلبات وارد بعد')}
      description={t(
        'Create your first inbound order to start receiving stock.',
        'أنشئ أول طلب وارد لبدء استلام المخزون.',
      )}
      action={
        <Button type="button" onClick={() => navigate('/orders/inbound/new')}>
          <Plus aria-hidden />
          {t('New inbound', 'وارد جديد')}
        </Button>
      }
    />
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Inbound orders', 'طلبات الوارد')}
        description={t('Plan, approve, and track warehouse receiving.', 'خطّط ووافق وتتبّع استلام المستودع.')}
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload aria-hidden />
              {t('Import', 'استيراد')}
            </Button>
            <Button variant="outline" disabled={exporting} onClick={() => setExportOpen(true)}>
              {exporting ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
              {t('Export CSV', 'تصدير CSV')}
            </Button>
            <Button onClick={() => navigate('/orders/inbound/new')}>
              <Plus aria-hidden />
              {t('New inbound', 'وارد جديد')}
            </Button>
          </>
        }
      />

      {!effectiveWid ? (
        <Alert>
          <AlertTitle>{t('Warehouse not configured', 'المستودع غير مُعد')}</AlertTitle>
          <AlertDescription>
            {t(
              'The active warehouse could not be resolved. Contact your administrator.',
              'تعذر تحديد المستودع النشط. تواصل مع المسؤول.',
            )}
          </AlertDescription>
        </Alert>
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
            value={draftFilters.orderSearch}
            onChange={(v) => setDraft({ orderSearch: v })}
            placeholder={t('Search order # or client…', 'ابحث برقم الطلب أو العميل…')}
            clearLabel={t('Clear search', 'مسح البحث')}
          />
          <Select value={draftFilters.status || '__all'} onValueChange={(v) => setDraft({ status: v === '__all' ? '' : v })}>
            <SelectTrigger className="w-44" aria-label={t('Status', 'الحالة')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value || 'all'} value={opt.value || '__all'}>
                  {isArabic ? opt.ar : opt.en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant={advancedOpen ? 'secondary' : 'outline'}
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen(!advancedOpen)}
          >
            <SlidersHorizontal aria-hidden />
            {t('Advanced filters', 'تصفية متقدمة')}
            {advancedActive > 0 ? <Badge className="ms-1">{advancedActive}</Badge> : null}
          </Button>
          <div className="ms-auto flex items-center gap-2">
            <ResetFiltersButton
              label={t('Reset', 'إعادة تعيين')}
              onClick={() => {
                resetFilters()
                setAdvancedOpen(false)
              }}
            />
            <Button type="submit" disabled={pagination.isFetching}>
              {pagination.isFetching ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {t('Apply', 'تطبيق')}
            </Button>
          </div>
        </form>

        {advancedOpen ? (
          <div className="grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-3">
            {field(
              t('Client', 'العميل'),
              <Combobox
                id="inbound-f-client"
                value={draftFilters.companyId}
                onChange={(v) => setDraft({ companyId: v })}
                options={clientOptions}
                placeholder={t('All clients', 'كل العملاء')}
                searchPlaceholder={t('Search…', 'بحث…')}
                emptyLabel={t('No results', 'لا نتائج')}
              />,
              'inbound-f-client',
            )}
            {field(
              t('Warehouse', 'المستودع'),
              <Combobox
                id="inbound-f-wh"
                value={draftFilters.warehouseId}
                onChange={(v) => setDraft({ warehouseId: v })}
                options={warehouseOptions}
                placeholder={t('Default warehouse', 'المستودع الافتراضي')}
              />,
              'inbound-f-wh',
            )}
            {field(
              t('Created from', 'تاريخ الإنشاء من'),
              <Input
                id="inbound-f-from"
                type="date"
                value={draftFilters.createdFrom}
                onChange={(e) => setDraft({ createdFrom: e.target.value })}
              />,
              'inbound-f-from',
            )}
            {field(
              t('Created to', 'تاريخ الإنشاء إلى'),
              <Input
                id="inbound-f-to"
                type="date"
                value={draftFilters.createdTo}
                onChange={(e) => setDraft({ createdTo: e.target.value })}
              />,
              'inbound-f-to',
            )}
          </div>
        ) : null}
      </section>

      <DataTable<InboundOrder>
        columns={columns}
        data={pagination.rows}
        getRowId={(r) => r.id}
        loading={pagination.isInitialLoading || !effectiveWid}
        onRowClick={(o) => navigate(`/orders/inbound/${o.id}`)}
        empty={emptyNode}
        stateOverride={
          pagination.isError ? (
            <div role="alert" className="rounded-xl border border-tone-danger-border bg-tone-danger-bg p-4 text-sm text-tone-danger-fg">
              {(pagination.error as Error)?.message || t('Failed to load inbound orders.', 'تعذر تحميل طلبات الوارد.')}
            </div>
          ) : undefined
        }
        pagination={{
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onPageChange: pagination.setPage,
          onPageSizeChange: () => {},
        }}
        labels={{
          rowsPerPage: t('Rows per page', 'عدد الصفوف في الصفحة'),
          of: t('of', 'من'),
          noResults: t('No results', 'لا نتائج'),
        }}
      />

      <ConfirmDialog
        open={!!toCancel}
        title={t('Cancel this order?', 'إلغاء هذا الطلب؟')}
        confirmLabel={t('Cancel order', 'إلغاء الطلب')}
        cancelLabel={t('Keep order', 'الاحتفاظ بالطلب')}
        intent="danger"
        loading={cancelMut.isPending}
        onOpenChange={(o) => !o && !cancelMut.isPending && setToCancel(null)}
        onConfirm={() => {
          if (toCancel) cancelMut.mutate(toCancel.id)
        }}
      >
        <p className="text-sm">
          {t(
            'Cancelling stops all remaining work and deletes the order’s tasks. Already-received stock is not changed. This cannot be undone.',
            'سيؤدي الإلغاء إلى إيقاف جميع الأعمال المتبقية وحذف مهام الطلب. لن يتم تغيير المخزون المستلم بالفعل. لا يمكن التراجع عن هذا الإجراء.',
          )}
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!toDelete}
        title={t('Delete this order?', 'حذف هذا الطلب؟')}
        confirmLabel={t('Delete', 'حذف')}
        cancelLabel={t('Cancel', 'إلغاء')}
        intent="danger"
        loading={deleteMut.isPending}
        onOpenChange={(o) => !o && !deleteMut.isPending && setToDelete(null)}
        onConfirm={() => {
          if (toDelete) deleteMut.mutate(toDelete.id)
        }}
      >
        <p className="text-sm">
          {t(
            'This permanently removes the order and its lines. This action cannot be undone.',
            'سيؤدي هذا إلى حذف الطلب وبنوده نهائياً. لا يمكن التراجع عن هذا الإجراء.',
          )}
        </p>
      </ConfirmDialog>

      <InboundImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => void qc.invalidateQueries({ queryKey: QK.inboundOrders })}
        isArabic={isArabic}
      />
      <InboundExportDialog
        open={exportOpen}
        onClose={() => {
          if (!exporting) setExportOpen(false)
        }}
        columns={exportColumns}
        exporting={exporting}
        onExport={(p) => void onExportSubmit(p)}
        isArabic={isArabic}
      />
    </div>
  )
}
