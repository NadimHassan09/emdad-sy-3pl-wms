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
import { Checkbox } from '@emdad/ui/ui/checkbox'
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
import { CompaniesApi } from '@/api/companies'
import { OutboundApi, type OutboundOrder } from '@/api/outbound'
import { useAuth } from '@/auth/AuthContext'
import { QK } from '@/constants/query-keys'
import { useCachedState } from '@/hooks/useCachedState'
import { CHUNK_SIZE_STANDARD, useChunkedServerPagination } from '@/hooks/useChunkedServerPagination'
import { useDefaultWarehouseId } from '@/hooks/useDefaultWarehouse'
import { useFilters } from '@/hooks/useFilters'
import { companyFilterComboboxOptions } from '@/lib/company-filter-options'
import { invalidateWorkflowTasksInventory } from '@/lib/invalidate-wms-queries'
import {
  buildOutboundListParams,
  countAppliedOutboundAdvancedFilters,
  OUTBOUND_LIST_FILTER_DEFAULTS,
  type OutboundListFilterState,
} from '@/lib/outbound-list-params'
import { canAccessInternalTransfer } from '@/lib/rbac'
import { OutboundBulkShippingDialog } from './OutboundBulkShippingDialog'
import { OutboundExportDialog, type OutboundExportColumnOption } from './OutboundExportDialog'
import { OutboundImportDialog } from './OutboundImportDialog'
import { OUTBOUND_STATUS_FILTER_OPTIONS, OutboundStatusBadge } from './outbound-ui'

type RowAction = { key: string; label: string; onClick: () => void; destructive?: boolean }

function isBulkShippingCandidate(o: OutboundOrder): boolean {
  if (o.status !== 'ready_to_ship') return false
  if (o.trackingNumber?.trim()) return false
  const created = (o.carrierShipments ?? []).some((s) => s.status === 'created')
  return !created
}

export function OutboundListPage() {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const isAdmin = canAccessInternalTransfer(user?.role)
  const { warehouseId: defaultWid } = useDefaultWarehouseId()
  const [searchParams] = useSearchParams()

  const [toCancel, setToCancel] = useState<OutboundOrder | null>(null)
  const [toDelete, setToDelete] = useState<OutboundOrder | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkOpen, setBulkOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportColumns, setExportColumns] = useState<OutboundExportColumnOption[]>([])
  const [exporting, setExporting] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useCachedState('outbound-orders:advanced-open', false)

  const { draftFilters, appliedFilters, setDraft, applyPatch, applyFilters, resetFilters } =
    useFilters<OutboundListFilterState>(OUTBOUND_LIST_FILTER_DEFAULTS)

  useEffect(() => {
    const status = searchParams.get('status') ?? ''
    if (status && status !== appliedFilters.status) applyPatch({ status })
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

  const listParams = useMemo(() => buildOutboundListParams(appliedFilters, defaultWid), [appliedFilters, defaultWid])
  const effectiveWid = listParams.warehouseId
  const advancedActive = countAppliedOutboundAdvancedFilters(appliedFilters)

  const pagination = useChunkedServerPagination<OutboundOrder>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: listParams,
    fetchChunk: (offset, limit) => OutboundApi.list({ ...listParams, offset, limit }),
    rtQueryKeyPrefix: QK.outboundOrders,
    chunkQueryKeyPrefix: 'outbound-orders-chunk',
    enabled: !!effectiveWid,
  })

  useEffect(() => {
    setSelectedIds(new Set())
  }, [listParams])

  const pageIds = useMemo(() => pagination.rows.map((o) => o.id), [pagination.rows])
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))
  const selectedEligibleIds = useMemo(
    () =>
      [...selectedIds].filter((id) => {
        const order = pagination.rows.find((o) => o.id === id)
        return order ? isBulkShippingCandidate(order) : false
      }),
    [selectedIds, pagination.rows],
  )

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const cancelMut = useMutation({
    mutationFn: (orderId: string) => OutboundApi.cancel(orderId),
    onSuccess: (_data, orderId) => {
      toast.success(t('Order cancelled.', 'تم إلغاء الطلب.'))
      setToCancel(null)
      void qc.invalidateQueries({ queryKey: QK.outboundOrders })
      invalidateWorkflowTasksInventory(qc, { referenceId: orderId, referenceType: 'outbound_order' })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMut = useMutation({
    mutationFn: (orderId: string) => OutboundApi.remove(orderId),
    onSuccess: () => {
      toast.success(t('Order deleted.', 'تم حذف الطلب.'))
      setToDelete(null)
      void qc.invalidateQueries({ queryKey: QK.outboundOrders })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const rowActions = (o: OutboundOrder): RowAction[] => {
    const actions: RowAction[] = [
      { key: 'open', label: t('Open details', 'فتح التفاصيل'), onClick: () => navigate(`/orders/outbound/${o.id}`) },
    ]
    if (o.status === 'draft' || o.status === 'pending_approval') {
      actions.push({
        key: 'edit',
        label: t('Edit plan', 'تعديل الخطة'),
        onClick: () => navigate(`/orders/outbound/${o.id}/edit`),
      })
    }
    if (o.status !== 'shipped' && o.status !== 'cancelled') {
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
    void OutboundApi.exportColumns().then(setExportColumns).catch(() => setExportColumns([]))
  }, [])

  const onExportSubmit = async (payload: { columnIds: string[]; arabicHeaders: boolean }) => {
    if (exporting) return
    setExporting(true)
    try {
      const ids = selectedIds.size > 0 ? Array.from(selectedIds) : undefined
      await OutboundApi.exportDownloadPost({ ...listParams, ...payload, ids })
      setExportOpen(false)
      toast.success(t('Exported to CSV.', 'تم تنزيل ملف CSV.'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Export failed.', 'فشل التصدير.'))
    } finally {
      setExporting(false)
    }
  }

  const columns = useMemo<ColumnDef<OutboundOrder>[]>(
    () => [
      ...(isAdmin
        ? [
            {
              id: 'select',
              header: () => (
                <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={allPageSelected || (pageIds.some((id) => selectedIds.has(id)) && 'indeterminate')}
                    disabled={pageIds.length === 0}
                    aria-label={t('Select all on page', 'تحديد الكل في الصفحة')}
                    onCheckedChange={() => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev)
                        if (allPageSelected) pageIds.forEach((id) => next.delete(id))
                        else pageIds.forEach((id) => next.add(id))
                        return next
                      })
                    }}
                  />
                </div>
              ),
              cell: ({ row }) => (
                <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(row.original.id)}
                    aria-label={t(`Select ${row.original.orderNumber}`, `تحديد ${row.original.orderNumber}`)}
                    onClick={(e) => e.stopPropagation()}
                    onCheckedChange={() => toggleOne(row.original.id)}
                  />
                </div>
              ),
              meta: { priority: 1, className: 'w-10', hideInCard: true },
            } satisfies ColumnDef<OutboundOrder>,
          ]
        : []),
      {
        id: 'orderNumber',
        header: t('Order #', 'رقم الطلب'),
        cell: ({ row }) => <span className="font-mono text-sm">{row.original.orderNumber || '—'}</span>,
        meta: { priority: 1, className: 'min-w-36' },
      },
      {
        id: 'client',
        header: t('Client', 'العميل'),
        cell: ({ row }) => <span className="text-sm font-medium">{row.original.company?.name?.trim() || '—'}</span>,
        meta: { priority: 2, className: 'min-w-40' },
      },
      {
        id: 'status',
        header: t('Status', 'الحالة'),
        cell: ({ row }) => <OutboundStatusBadge status={row.original.status} isArabic={isArabic} />,
        meta: { priority: 1, className: 'min-w-32 whitespace-nowrap' },
      },
      {
        id: 'requiredShip',
        header: t('Required ship', 'الشحن المطلوب'),
        cell: ({ row }) => (
          <span className="text-sm tabular">{formatDate(row.original.requiredShipDate, locale)}</span>
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
        id: 'destination',
        header: t('Destination', 'الوجهة'),
        cell: ({ row }) => (
          <span className="line-clamp-2 text-sm">{row.original.destinationAddress?.trim() || '—'}</span>
        ),
        meta: { priority: 3, className: 'min-w-48' },
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
    [isArabic, locale, isAdmin, selectedIds, allPageSelected, pageIds],
  )

  const field = (label: string, node: React.ReactNode, id?: string) => (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {node}
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Outbound orders', 'طلبات الصادر')}
        description={t('Warehouse shipment requests and execution.', 'طلبات الشحن الصادر وتنفيذها.')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin ? (
              <Button
                type="button"
                variant="outline"
                disabled={selectedEligibleIds.length === 0}
                onClick={() => setBulkOpen(true)}
              >
                {t('Bulk shipping', 'شحن جماعي')}
                {selectedEligibleIds.length > 0 ? ` (${selectedEligibleIds.length})` : ''}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" aria-hidden />
              {t('Import', 'استيراد')}
            </Button>
            <Button type="button" variant="outline" disabled={exporting} onClick={() => setExportOpen(true)}>
              {exporting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download aria-hidden />}
              {t('Export CSV', 'تصدير CSV')}
            </Button>
            <Button type="button" onClick={() => navigate('/orders/outbound/new')}>
              <Plus className="size-4" aria-hidden />
              {t('New outbound', 'صادر جديد')}
            </Button>
          </div>
        }
      />

      {!effectiveWid ? (
        <Alert>
          <AlertTitle>{t('Warehouse not configured', 'المستودع غير مهيأ')}</AlertTitle>
          <AlertDescription>
            {t(
              'Set a default warehouse before creating or listing outbound orders.',
              'عيّن مستودعاً افتراضياً قبل إنشاء أو عرض طلبات الصادر.',
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
              {OUTBOUND_STATUS_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value || 'all'} value={opt.value || '__all'}>
                  {isArabic ? opt.labelAr : opt.labelEn}
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
                id="outbound-f-client"
                value={draftFilters.companyId}
                onChange={(v) => setDraft({ companyId: v })}
                options={clientOptions}
                placeholder={t('All clients', 'كل العملاء')}
                searchPlaceholder={t('Search…', 'بحث…')}
                emptyLabel={t('No results', 'لا نتائج')}
              />,
              'outbound-f-client',
            )}
            {field(
              t('Created from', 'تاريخ الإنشاء من'),
              <Input
                id="outbound-f-from"
                type="date"
                value={draftFilters.createdFrom}
                onChange={(e) => setDraft({ createdFrom: e.target.value })}
              />,
              'outbound-f-from',
            )}
            {field(
              t('Created to', 'تاريخ الإنشاء إلى'),
              <Input
                id="outbound-f-to"
                type="date"
                value={draftFilters.createdTo}
                onChange={(e) => setDraft({ createdTo: e.target.value })}
              />,
              'outbound-f-to',
            )}
          </div>
        ) : null}
      </section>

      <DataTable<OutboundOrder>
        columns={columns}
        data={pagination.rows}
        getRowId={(r) => r.id}
        loading={pagination.isInitialLoading || !effectiveWid}
        onRowClick={(row) => navigate(`/orders/outbound/${row.id}`)}
        empty={
          !effectiveWid ? (
            <EmptyState title={t('Warehouse required', 'المستودع مطلوب')} description={t('Configure a warehouse to load orders.', 'هيّئ مستودعاً لتحميل الطلبات.')} />
          ) : (
            <EmptyState title={t('No outbound orders', 'لا طلبات صادر')} description={t('Try adjusting filters or create a new order.', 'جرّب تغيير الفلاتر أو أنشئ طلباً جديداً.')} />
          )
        }
        stateOverride={
          pagination.isError ? (
            <div role="alert" className="rounded-xl border border-tone-danger-border bg-tone-danger-bg p-4 text-sm text-tone-danger-fg">
              {(pagination.error as Error)?.message || t('Failed to load outbound orders.', 'تعذر تحميل طلبات الصادر.')}
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
        onOpenChange={(o) => !cancelMut.isPending && !o && setToCancel(null)}
        intent="danger"
        title={t('Cancel this order?', 'إلغاء هذا الطلب؟')}
        description={t(
          'Cancelling stops remaining work and deletes tasks. Product quantities are not changed. This cannot be undone.',
          'الإلغاء يوقف العمل المتبقي ويحذف المهام. لن تتغير كميات المنتجات. لا يمكن التراجع.',
        )}
        confirmLabel={t('Cancel order', 'إلغاء الطلب')}
        cancelLabel={t('Keep order', 'الاحتفاظ بالطلب')}
        loading={cancelMut.isPending}
        onConfirm={() => { if (toCancel) cancelMut.mutate(toCancel.id) }}
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !deleteMut.isPending && !o && setToDelete(null)}
        intent="danger"
        title={t('Delete this order?', 'حذف هذا الطلب؟')}
        description={t(
          'This permanently removes the order and its lines.',
          'يحذف هذا الطلب وبنوده نهائياً.',
        )}
        confirmLabel={t('Delete', 'حذف')}
        cancelLabel={t('Cancel', 'إلغاء')}
        loading={deleteMut.isPending}
        onConfirm={() => { if (toDelete) deleteMut.mutate(toDelete.id) }}
      />

      <OutboundImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImported={() => void qc.invalidateQueries({ queryKey: QK.outboundOrders })} isArabic={isArabic} />
      <OutboundExportDialog open={exportOpen} onClose={() => !exporting && setExportOpen(false)} columns={exportColumns} exporting={exporting} onExport={(p) => void onExportSubmit(p)} isArabic={isArabic} />
      {isAdmin ? (
        <OutboundBulkShippingDialog
          open={bulkOpen}
          outboundOrderIds={selectedEligibleIds}
          isArabic={isArabic}
          onClose={() => {
            setBulkOpen(false)
            setSelectedIds(new Set())
          }}
        />
      ) : null}
    </div>
  )
}
