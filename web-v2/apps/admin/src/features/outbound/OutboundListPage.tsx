import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Download, Loader2, MoreHorizontal, Plus, SlidersHorizontal, Upload, Zap } from 'lucide-react'
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
import { Button } from '@emdad/ui/ui/button'
import { Checkbox } from '@emdad/ui/ui/checkbox'
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
import { OutboundApi, type OutboundOrder, type QuickDirectedOutboundResult } from '@/api/outbound'
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
  OUTBOUND_LIST_FILTER_DEFAULTS,
  type OutboundListFilterState,
} from '@/lib/outbound-list-params'
import { canAccessInternalTransfer } from '@/lib/rbac'
import { CreateQuickDirectedOutboundModal } from './CreateQuickDirectedOutboundModal'
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

function countAdvanced(f: OutboundListFilterState): number {
  let n = 0
  if (f.status.trim()) n++
  if (f.createdFrom.trim()) n++
  if (f.createdTo.trim()) n++
  if (f.companyId.trim()) n++
  return n
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
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickSuccess, setQuickSuccess] = useState<QuickDirectedOutboundResult | null>(null)
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

  const pageEligibleIds = useMemo(
    () => pagination.rows.filter(isBulkShippingCandidate).map((o) => o.id),
    [pagination.rows],
  )
  const allPageEligibleSelected =
    pageEligibleIds.length > 0 && pageEligibleIds.every((id) => selectedIds.has(id))

  const toggleOne = (id: string, eligible: boolean) => {
    if (!eligible) return
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

  const quickMut = useMutation({
    mutationFn: (input: { productCode: string; quantity: number; reasonCode: QuickDirectedOutboundResult['reasonCode'] }) => {
      if (!defaultWid) throw new Error(t('Warehouse is required.', 'المستودع مطلوب.'))
      return OutboundApi.quickDirected({ warehouseId: defaultWid, ...input })
    },
    onSuccess: (result) => {
      invalidateWorkflowTasksInventory(qc, { referenceId: result.orderId, referenceType: 'outbound_order' })
      void qc.invalidateQueries({ queryKey: QK.outboundOrders })
      setQuickOpen(false)
      setQuickSuccess(result)
      toast.success(isArabic ? result.messageAr : result.messageEn)
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
                <Checkbox
                  checked={allPageEligibleSelected}
                  disabled={pageEligibleIds.length === 0}
                  aria-label={t('Select eligible on page', 'تحديد المؤهل في الصفحة')}
                  onCheckedChange={() => {
                    setSelectedIds((prev) => {
                      const next = new Set(prev)
                      if (allPageEligibleSelected) pageEligibleIds.forEach((id) => next.delete(id))
                      else pageEligibleIds.forEach((id) => next.add(id))
                      return next
                    })
                  }}
                />
              ),
              cell: ({ row }) => {
                const eligible = isBulkShippingCandidate(row.original)
                return (
                  <Checkbox
                    checked={selectedIds.has(row.original.id)}
                    disabled={!eligible}
                    aria-label={t(`Select ${row.original.orderNumber}`, `تحديد ${row.original.orderNumber}`)}
                    onCheckedChange={() => toggleOne(row.original.id, eligible)}
                  />
                )
              },
              meta: { priority: 1, className: 'w-10' },
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
    [isArabic, locale, isAdmin, selectedIds, allPageEligibleSelected, pageEligibleIds],
  )

  const advancedActive = countAdvanced(appliedFilters)
  const hasActiveFilters = Boolean(
    appliedFilters.orderSearch.trim() || advancedActive > 0,
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
                disabled={selectedIds.size === 0}
                onClick={() => setBulkOpen(true)}
              >
                {t('Bulk shipping', 'شحن جماعي')}
                {selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => setQuickOpen(true)}>
              <Zap className="size-4" aria-hidden />
              {t('Quick outbound', 'إخراج سريع')}
            </Button>
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

      {quickSuccess ? (
        <Alert>
          <AlertTitle>{t('Quick outbound created', 'تم الإخراج السريع')}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            <span>{quickSuccess.orderNumber}</span>
            <Button type="button" variant="link" className="h-auto p-0" onClick={() => navigate(`/orders/outbound/${quickSuccess.orderId}`)}>
              {t('Open order', 'فتح الطلب')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setQuickSuccess(null)}>
              {t('Dismiss', 'إغلاق')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0 flex-1 sm:max-w-md">
            <SearchInput
              value={draftFilters.orderSearch}
              onChange={(v) => setDraft({ orderSearch: v })}
              placeholder={t('Search order # or client…', 'ابحث برقم الطلب أو العميل…')}
              aria-label={t('Search', 'بحث')}
            />
          </div>
          <Select value={draftFilters.status || '__all'} onValueChange={(v) => setDraft({ status: v === '__all' ? '' : v })}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder={t('Status', 'الحالة')} />
            </SelectTrigger>
            <SelectContent>
              {OUTBOUND_STATUS_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value || 'all'} value={opt.value || '__all'}>
                  {isArabic ? opt.labelAr : opt.labelEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" onClick={() => applyFilters()}>
            {t('Apply', 'تطبيق')}
          </Button>
          <Button type="button" variant="outline" onClick={() => setAdvancedOpen((o) => !o)}>
            <SlidersHorizontal className="size-4" aria-hidden />
            {t('Advanced', 'متقدم')}
            {advancedActive > 0 ? ` (${advancedActive})` : ''}
          </Button>
          {hasActiveFilters ? <ResetFiltersButton label={t('Reset', 'إعادة تعيين')} onClick={() => resetFilters()} /> : null}
        </div>

        {advancedOpen ? (
          <div className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
            {field(
              t('Client', 'العميل'),
              <Select value={draftFilters.companyId || '__all'} onValueChange={(v) => setDraft({ companyId: v === '__all' ? '' : v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {clientOptions.map((o) => (
                    <SelectItem key={o.value || 'all'} value={o.value || '__all'}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>,
            )}
            {field(
              t('Created from', 'تاريخ الإنشاء من'),
              <Input type="date" value={draftFilters.createdFrom} onChange={(e) => setDraft({ createdFrom: e.target.value })} />,
            )}
            {field(
              t('Created to', 'تاريخ الإنشاء إلى'),
              <Input type="date" value={draftFilters.createdTo} onChange={(e) => setDraft({ createdTo: e.target.value })} />,
            )}
          </div>
        ) : null}
      </div>

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
      <CreateQuickDirectedOutboundModal open={quickOpen} loading={quickMut.isPending} isArabic={isArabic} onClose={() => setQuickOpen(false)} onSubmit={(input) => quickMut.mutate(input)} />
      {isAdmin ? (
        <OutboundBulkShippingDialog
          open={bulkOpen}
          outboundOrderIds={[...selectedIds]}
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
