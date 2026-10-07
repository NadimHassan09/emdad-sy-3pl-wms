import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { ColumnDef, OnChangeFn, RowSelectionState } from '@tanstack/react-table'
import { toast } from 'sonner'
import { Ban, Check, Download, Loader2, Plus, SlidersHorizontal, Upload, X } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import {
  ConfirmDialog,
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
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { useCachedState } from '@/hooks/useCachedState'
import { CHUNK_SIZE_STANDARD, useChunkedServerPagination } from '@/hooks/useChunkedServerPagination'
import { useClientOperationalAccess } from '@/hooks/useClientOperationalAccess'
import { useFilters } from '@/hooks/useFilters'
import { mapClientOmsCommercialDisplayStatus } from '@/lib/client-oms-commercial-status'
import {
  cancelClientOmsOrdersBulk,
  confirmClientOmsOrdersBulk,
  fetchClientOmsNavCounts,
  fetchClientOmsOrders,
  type ClientOmsOperationalStage,
  type ClientOmsOrderListItem,
  type ClientOmsOrderStatus,
  type ClientOmsTotalOp,
} from '@/services/clientOmsOrdersService'
import {
  CLIENT_OMS_EXPORT_COLUMNS,
  downloadClientOrdersExport,
} from '@/services/clientOrdersExport'
import { OmsExportDialog } from './OmsExportDialog'
import { OmsImportDialog } from './OmsImportDialog'
import { OmsSectionTabs } from './OmsSectionTabs'
import { OmsStatusNav } from './OmsStatusNav'
import { OmsStatusBadge } from './oms-ui'

type ListFilters = {
  search: string
  status: string
  customer: string
  phone: string
  city: string
  carrier: string
  startOrderNo: string
  endOrderNo: string
  totalOp: string
  totalValue: string
  operationalStage: string
  createdFrom: string
  createdTo: string
}

const DEFAULTS: ListFilters = {
  search: '',
  status: '',
  customer: '',
  phone: '',
  city: '',
  carrier: '',
  startOrderNo: '',
  endOrderNo: '',
  totalOp: 'eq',
  totalValue: '',
  operationalStage: '',
  createdFrom: '',
  createdTo: '',
}

const TOTAL_OPS: Array<{ value: ClientOmsTotalOp; en: string; ar: string }> = [
  { value: 'eq', en: 'Equals (=)', ar: 'يساوي (=)' },
  { value: 'gt', en: 'Greater than (>)', ar: 'أكبر من (>)' },
  { value: 'gte', en: 'At least (≥)', ar: 'على الأقل (≥)' },
  { value: 'lt', en: 'Less than (<)', ar: 'أقل من (<)' },
  { value: 'lte', en: 'At most (≤)', ar: 'على الأكثر (≤)' },
]

const STAGES: Array<{ value: ClientOmsOperationalStage; en: string; ar: string }> = [
  { value: 'picking', en: 'Picking', ar: 'الالتقاط' },
  { value: 'packing', en: 'Packing', ar: 'التعبئة' },
  { value: 'shipping_details', en: 'Shipping details', ar: 'تفاصيل الشحن' },
  { value: 'shipping_confirmation', en: 'Shipping confirmation', ar: 'تأكيد الشحن' },
]

const trimmed = (v: string | undefined) => {
  const s = (v ?? '').trim()
  return s || undefined
}

function isConfirmableOrder(row: ClientOmsOrderListItem): boolean {
  if (row.needsInformation) return false
  const commercial = mapClientOmsCommercialDisplayStatus(row.status)
  return row.status === 'waiting_for_confirmation' || commercial === 'waiting_for_confirmation'
}

function isCancellableOrder(row: ClientOmsOrderListItem): boolean {
  const commercial = mapClientOmsCommercialDisplayStatus(row.status)
  return row.status === 'waiting_for_confirmation' || commercial === 'waiting_for_confirmation'
}

function countAdvanced(f: ListFilters): number {
  let n = 0
  for (const k of [
    'customer',
    'phone',
    'city',
    'carrier',
    'startOrderNo',
    'endOrderNo',
    'totalValue',
    'operationalStage',
    'createdFrom',
    'createdTo',
  ] as const) {
    if (f[k]?.trim()) n += 1
  }
  return n
}

export function EcommerceOrdersListPage() {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const billing = useClientOperationalAccess(isArabic)

  const {
    draftFilters: draftRaw,
    appliedFilters: appliedRaw,
    setDraft,
    applyFilters,
    applyPatch,
    resetFilters,
  } = useFilters<ListFilters>(DEFAULTS)

  const draft = useMemo(() => ({ ...DEFAULTS, ...draftRaw }), [draftRaw])
  const applied = useMemo(() => ({ ...DEFAULTS, ...appliedRaw }), [appliedRaw])

  const [advancedOpen, setAdvancedOpen] = useCachedState('ecommerce-orders:advanced-open', false)
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false)

  const rangeError = useMemo(() => {
    const start = draft.startOrderNo.trim()
    const end = draft.endOrderNo.trim()
    if (start && end && start.localeCompare(end, undefined, { numeric: true }) > 0) {
      return t(
        'Start order number must not be after the end order number.',
        'رقم طلب البداية يجب ألا يكون بعد رقم النهاية.',
      )
    }
    return null
  }, [draft.startOrderNo, draft.endOrderNo, isArabic]) // eslint-disable-line react-hooks/exhaustive-deps

  const filterKey = useMemo(() => {
    const totalValue = trimmed(applied.totalValue)
    return {
      orderSearch: trimmed(applied.search),
      status: (applied.status || undefined) as ClientOmsOrderStatus | undefined,
      customer: trimmed(applied.customer),
      phone: trimmed(applied.phone),
      city: trimmed(applied.city),
      carrier: trimmed(applied.carrier),
      startOrderNo: trimmed(applied.startOrderNo),
      endOrderNo: trimmed(applied.endOrderNo),
      totalOp: totalValue ? ((applied.totalOp || 'eq') as ClientOmsTotalOp) : undefined,
      totalValue,
      operationalStage: (applied.operationalStage || undefined) as ClientOmsOperationalStage | undefined,
      createdFrom: trimmed(applied.createdFrom),
      createdTo: trimmed(applied.createdTo),
    }
  }, [applied])

  const navCountParams = useMemo(() => {
    const { status: _s, operationalStage: _o, ...rest } = filterKey
    return rest
  }, [filterKey])

  const navCounts = useQuery({
    queryKey: ['client', 'ecommerce-orders', 'nav-counts', navCountParams],
    queryFn: () => fetchClientOmsNavCounts(navCountParams),
  })

  const pagination = useChunkedServerPagination<ClientOmsOrderListItem>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey,
    fetchChunk: (offset, limit) => fetchClientOmsOrders({ ...filterKey, offset, limit }),
    rtQueryKeyPrefix: ['client', 'ecommerce-orders'],
    chunkQueryKeyPrefix: 'client-ecommerce-orders-chunk',
  })

  useEffect(() => {
    setSelectedIds(new Set())
  }, [JSON.stringify(filterKey), pagination.page]) // eslint-disable-line react-hooks/exhaustive-deps

  const rowSelection = useMemo<RowSelectionState>(
    () => Object.fromEntries([...selectedIds].map((id) => [id, true])),
    [selectedIds],
  )
  const onRowSelectionChange: OnChangeFn<RowSelectionState> = (updater) => {
    const next = typeof updater === 'function' ? updater(rowSelection) : updater
    setSelectedIds(new Set(Object.keys(next).filter((k) => next[k])))
  }

  const selectedConfirmable = useMemo(
    () => pagination.rows.filter((r) => selectedIds.has(r.id) && isConfirmableOrder(r)),
    [pagination.rows, selectedIds],
  )
  const selectedCancellable = useMemo(
    () => pagination.rows.filter((r) => selectedIds.has(r.id) && isCancellableOrder(r)),
    [pagination.rows, selectedIds],
  )

  const invalidate = () => {
    void pagination.refetch()
    void navCounts.refetch()
  }

  const confirmBulkMut = useMutation({
    mutationFn: () => confirmClientOmsOrdersBulk(selectedConfirmable.map((o) => o.id)),
    onSuccess: (result) => {
      setSelectedIds(new Set())
      setBulkConfirmOpen(false)
      invalidate()
      if (result.failed > 0) {
        toast.error(
          t(
            `Confirmed ${result.confirmed}/${result.requested}. Some failed.`,
            `تم تأكيد ${result.confirmed}/${result.requested}. فشل بعضها.`,
          ),
        )
      } else {
        toast.success(t(`Confirmed ${result.confirmed} order(s).`, `تم تأكيد ${result.confirmed} طلب.`))
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const cancelBulkMut = useMutation({
    mutationFn: () => cancelClientOmsOrdersBulk(selectedCancellable.map((o) => o.id)),
    onSuccess: (result) => {
      setSelectedIds(new Set())
      setBulkCancelOpen(false)
      invalidate()
      if (result.failed > 0) {
        toast.error(
          t(
            `Cancelled ${result.cancelled}/${result.requested}. Some failed.`,
            `تم إلغاء ${result.cancelled}/${result.requested}. فشل بعضها.`,
          ),
        )
      } else {
        toast.success(t(`Cancelled ${result.cancelled} order(s).`, `تم إلغاء ${result.cancelled} طلب.`))
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const onExportSubmit = async (payload: { columnIds: string[]; arabicHeaders: boolean }) => {
    if (exporting) return
    setExporting(true)
    setExportError(null)
    try {
      const ids = selectedIds.size > 0 ? [...selectedIds] : undefined
      await downloadClientOrdersExport('oms', {
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

  const onApply = () => {
    if (rangeError) return
    applyFilters()
  }

  const advancedActive = countAdvanced(applied)
  const hasFilters =
    advancedActive > 0 || Boolean(applied.search.trim()) || Boolean(applied.status.trim())

  const columns = useMemo<ColumnDef<ClientOmsOrderListItem>[]>(
    () => [
      {
        id: 'orderNumber',
        header: t('Order #', 'رقم الطلب'),
        cell: ({ row }) => (
          <span className="font-mono text-sm font-medium">{row.original.orderNumber}</span>
        ),
        meta: { priority: 1, className: 'min-w-32' },
      },
      {
        id: 'status',
        header: t('Status', 'الحالة'),
        cell: ({ row }) => (
          <OmsStatusBadge
            status={row.original.status}
            isArabic={isArabic}
            needsInformation={row.original.needsInformation}
          />
        ),
        meta: { priority: 1, className: 'min-w-40' },
      },
      {
        id: 'recipient',
        header: t('Recipient', 'المستلم'),
        cell: ({ row }) => row.original.recipientName?.trim() || '—',
        meta: { priority: 2, className: 'min-w-32' },
      },
      {
        id: 'city',
        header: t('City', 'المدينة'),
        cell: ({ row }) => row.original.city?.trim() || '—',
        meta: { priority: 3, className: 'min-w-24' },
      },
      {
        id: 'total',
        header: t('Total', 'الإجمالي'),
        cell: ({ row: { original: o } }) => (
          <span className="tabular">
            {o.total ? `${o.total}${o.currency ? ` ${o.currency}` : ''}` : '—'}
          </span>
        ),
        meta: { priority: 2, align: 'end', className: 'min-w-24' },
      },
      {
        id: 'created',
        header: t('Created', 'تاريخ الإنشاء'),
        cell: ({ row }) => (
          <span className="tabular text-sm text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleDateString()}
          </span>
        ),
        meta: { priority: 2, align: 'end', className: 'min-w-28' },
      },
    ],
    [isArabic], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const field = (label: string, node: React.ReactNode) => (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {node}
    </div>
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Online orders', 'الطلبات الإلكترونية')}
        description={t('Orders from your store channels', 'طلبات من قنوات متجرك')}
        actions={
          <>
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
            <Button
              type="button"
              disabled={!billing.operationalAllowed}
              title={billing.operationalAllowed ? undefined : billing.actionBlockedReason}
              onClick={() => navigate('/ecommerce-orders/new')}
            >
              <Plus aria-hidden />
              {t('Create order', 'إنشاء طلب')}
            </Button>
          </>
        }
      />

      <OmsSectionTabs isArabic={isArabic} />

      <OmsImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={invalidate}
        isArabic={isArabic}
        disabled={!billing.operationalAllowed}
        disabledReason={billing.actionBlockedReason}
      />

      <OmsExportDialog
        open={exportOpen}
        onClose={() => !exporting && setExportOpen(false)}
        columns={CLIENT_OMS_EXPORT_COLUMNS}
        exporting={exporting}
        onExport={(p) => void onExportSubmit(p)}
        isArabic={isArabic}
        errorMessage={exportError}
      />

      <section aria-label={t('Filters', 'التصفية')} className="space-y-3 rounded-xl border bg-card p-3">
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            onApply()
          }}
        >
          <SearchInput
            value={draft.search}
            onChange={(v) => setDraft({ search: v })}
            placeholder={t('Search order number…', 'ابحث برقم الطلب…')}
            className="min-w-48 flex-1"
          />
          <Button type="submit" disabled={Boolean(rangeError) || pagination.isFetching}>
            {t('Apply', 'تطبيق')}
          </Button>
          <ResetFiltersButton
            label={t('Reset', 'إعادة تعيين')}
            onClick={() => {
              resetFilters()
              setAdvancedOpen(false)
            }}
          />
          <Button
            type="button"
            variant={advancedOpen ? 'secondary' : 'outline'}
            onClick={() => setAdvancedOpen((o) => !o)}
          >
            <SlidersHorizontal aria-hidden />
            {t('Advanced', 'متقدم')}
            {advancedActive > 0 ? (
              <Badge className="ms-1 tabular">{advancedActive}</Badge>
            ) : null}
          </Button>
        </form>

        {advancedOpen ? (
          <div className="grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-3">
            {field(
              t('Customer', 'الزبون'),
              <Input
                value={draft.customer}
                onChange={(e) => setDraft({ customer: e.target.value })}
                placeholder={t('Customer name…', 'اسم الزبون…')}
              />,
            )}
            {field(
              t('Phone', 'الهاتف'),
              <Input
                value={draft.phone}
                onChange={(e) => setDraft({ phone: e.target.value })}
                placeholder={t('Phone number…', 'رقم الهاتف…')}
              />,
            )}
            {field(
              t('City', 'المدينة'),
              <Input
                value={draft.city}
                onChange={(e) => setDraft({ city: e.target.value })}
                placeholder={t('City…', 'المدينة…')}
              />,
            )}
            {field(
              t('Carrier', 'شركة الشحن'),
              <Input
                value={draft.carrier}
                onChange={(e) => setDraft({ carrier: e.target.value })}
                placeholder={t('Carrier name…', 'اسم شركة الشحن…')}
              />,
            )}
            {field(
              t('Start Order No.', 'رقم طلب البداية'),
              <Input
                value={draft.startOrderNo}
                onChange={(e) => setDraft({ startOrderNo: e.target.value })}
              />,
            )}
            {field(
              t('End Order No.', 'رقم طلب النهاية'),
              <Input
                value={draft.endOrderNo}
                onChange={(e) => setDraft({ endOrderNo: e.target.value })}
              />,
            )}
            {field(
              t('Total operator', 'مقارنة الإجمالي'),
              <Select value={draft.totalOp || 'eq'} onValueChange={(v) => setDraft({ totalOp: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TOTAL_OPS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {isArabic ? o.ar : o.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>,
            )}
            {field(
              t('Total value', 'قيمة الإجمالي'),
              <Input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={draft.totalValue}
                onChange={(e) => setDraft({ totalValue: e.target.value })}
                placeholder="0"
              />,
            )}
            {field(
              t('Operational stage', 'المرحلة التشغيلية'),
              <Select
                value={draft.operationalStage || '__all__'}
                onValueChange={(v) => setDraft({ operationalStage: v === '__all__' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('All stages', 'كل المراحل')}</SelectItem>
                  {STAGES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {isArabic ? s.ar : s.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>,
            )}
            {field(
              t('Created from', 'تاريخ الإنشاء من'),
              <Input
                type="date"
                value={draft.createdFrom}
                onChange={(e) => setDraft({ createdFrom: e.target.value })}
              />,
            )}
            {field(
              t('Created to', 'تاريخ الإنشاء إلى'),
              <Input
                type="date"
                value={draft.createdTo}
                onChange={(e) => setDraft({ createdTo: e.target.value })}
              />,
            )}
          </div>
        ) : null}

        {rangeError ? (
          <p role="alert" className="text-sm text-destructive">
            {rangeError}
          </p>
        ) : null}
      </section>

      <OmsStatusNav
        isArabic={isArabic}
        status={applied.status}
        counts={navCounts.data}
        onStatusChange={(status) => applyPatch({ status, operationalStage: '' })}
      />

      {selectedIds.size > 0 ? (
        <FilterBar
          className={cn(
            'items-center gap-2 rounded-xl border border-primary/30 bg-secondary p-2',
          )}
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
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={
              !billing.operationalAllowed ||
              selectedCancellable.length === 0 ||
              cancelBulkMut.isPending ||
              confirmBulkMut.isPending
            }
            onClick={() => setBulkCancelOpen(true)}
          >
            <Ban aria-hidden />
            {t(`Cancel (${selectedCancellable.length})`, `إلغاء (${selectedCancellable.length})`)}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={
              !billing.operationalAllowed ||
              selectedConfirmable.length === 0 ||
              confirmBulkMut.isPending ||
              cancelBulkMut.isPending
            }
            onClick={() => setBulkConfirmOpen(true)}
          >
            <Check aria-hidden />
            {t(`Confirm (${selectedConfirmable.length})`, `تأكيد (${selectedConfirmable.length})`)}
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

      <DataTable<ClientOmsOrderListItem>
        columns={columns}
        data={pagination.rows}
        getRowId={(r) => r.id}
        loading={pagination.isInitialLoading}
        rowSelection={rowSelection}
        onRowSelectionChange={onRowSelectionChange}
        onRowClick={(row) => navigate(`/ecommerce-orders/${row.id}`)}
        stateOverride={
          pagination.isError ? (
            <ErrorState
              title={t('Could not load online orders', 'تعذر تحميل الطلبات الإلكترونية')}
              retryLabel={t('Retry', 'إعادة المحاولة')}
              onRetry={() => void pagination.refetch()}
            />
          ) : undefined
        }
        empty={
          <EmptyState
            title={
              hasFilters
                ? t('No online orders match the filters.', 'لا توجد طلبات إلكترونية مطابقة للفلاتر.')
                : t('No online orders yet', 'لا توجد طلبات إلكترونية بعد')
            }
            description={
              hasFilters
                ? undefined
                : t(
                    'Create an order from your store channel to track it here.',
                    'أنشئ طلباً من قناة متجرك لتتبعه هنا.',
                  )
            }
            action={
              !hasFilters && billing.operationalAllowed ? (
                <Button type="button" onClick={() => navigate('/ecommerce-orders/new')}>
                  <Plus aria-hidden />
                  {t('Create first order', 'إنشاء أول طلب')}
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

      <ConfirmDialog
        open={bulkConfirmOpen}
        onOpenChange={setBulkConfirmOpen}
        intent="default"
        title={t('Confirm selected orders?', 'تأكيد الطلبات المحددة؟')}
        description={t(
          `Confirm ${selectedConfirmable.length} order(s) waiting for confirmation.`,
          `تأكيد ${selectedConfirmable.length} طلب بانتظار التأكيد.`,
        )}
        confirmLabel={t('Confirm', 'تأكيد')}
        cancelLabel={t('Back', 'رجوع')}
        loading={confirmBulkMut.isPending}
        onConfirm={() => confirmBulkMut.mutate()}
      />

      <ConfirmDialog
        open={bulkCancelOpen}
        onOpenChange={setBulkCancelOpen}
        intent="danger"
        title={t('Cancel selected orders?', 'إلغاء الطلبات المحددة؟')}
        description={t(
          `Cancel ${selectedCancellable.length} order(s) waiting for confirmation.`,
          `إلغاء ${selectedCancellable.length} طلب بانتظار التأكيد.`,
        )}
        confirmLabel={t('Cancel orders', 'إلغاء الطلبات')}
        cancelLabel={t('Back', 'رجوع')}
        loading={cancelBulkMut.isPending}
        onConfirm={() => cancelBulkMut.mutate()}
      />
    </div>
  )
}
