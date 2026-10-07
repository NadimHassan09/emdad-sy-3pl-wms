import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, OnChangeFn, RowSelectionState } from '@tanstack/react-table'
import { toast } from 'sonner'
import {
  Ban, Download, FileDown, FolderPlus, Layers, Loader2, MoreHorizontal, Plus, QrCode, SlidersHorizontal, Upload, X,
} from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import {
  ConfirmDialog, DataTable, FilterBar, PageHeader, ResetFiltersButton, SearchInput, cn, useNavigate,
} from '@emdad/ui'
import { Badge } from '@emdad/ui/ui/badge'
import { Button } from '@emdad/ui/ui/button'
import { Combobox } from '@emdad/ui/ui/combobox'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@emdad/ui/ui/dropdown-menu'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { CompaniesApi } from '@/api/companies'
import { OmsApi, type OmsOrderListItem } from '@/api/oms'
import { OutboundApi } from '@/api/outbound'
import { QK } from '@/constants/query-keys'
import { useCachedState } from '@/hooks/useCachedState'
import { useChunkedServerPagination } from '@/hooks/useChunkedServerPagination'
import { useFilters } from '@/hooks/useFilters'
import { companyFilterComboboxOptions } from '@/lib/company-filter-options'
import { mapOmsCommercialDisplayStatus } from '@/lib/oms-commercial-status'
import { orderOperationalStage, shouldShowOmsStageColumn } from '@/lib/oms-operational-stage'
import { isOmsAdminCancellableStatus } from '@/lib/oms-order-cancel'
import { isOmsOrderDeletable } from '@/lib/oms-order-delete'
import {
  buildOmsAppliedFilterSummary, buildOmsOrdersListParams, countAppliedOmsAdvancedFilters, normalizeOmsOrdersListFilters,
  OMS_ORDERS_FILTER_DEFAULTS, OMS_TOTAL_OPERATOR_OPTIONS, validateOmsOrderRange, type OmsOrdersListFilters, type OmsTotalOperator,
} from '@/lib/oms-orders-list-filters'
import { normalizeWaybillScan, orderMatchesWaybillScan, waybillScanAttempts } from '@/lib/oms-waybill-scan'
import { OmsAddToBatchDialog, OmsCreateBatchDialog } from './OmsBatchDialogs'
import { OmsExportDialog, OmsImportDialog, type OmsExportColumnOption } from './OmsFileDialogs'
import { BulkResultDialog, type BulkResult } from './OmsMisc'
import { OmsOrderFormDialog } from './OmsOrderFormDialog'
import { OmsWaybillDialog } from './OmsWaybillDialog'
import { OmsBulkShippingDetailsDialog } from './OmsBulkShippingDetailsDialog'
import { OmsScanDialog, type OmsScanResult } from './OmsScanDialog'
import { OmsStatusNav } from './OmsStatusNav'
import { OmsCarrierCell, OmsStageBadge, OmsStatusBadge } from './oms-ui'

type QrAction = 'confirm' | 'approve' | 'handover' | 'delivered' | 'failed'
const MAX_PAGE_SIZE = 1000
const PAGE_SIZES = [50, 100, 200, 500, 1000]

/** Backend fetch size: 200 when it divides evenly, otherwise one UI page per chunk. */
const resolveChunkSize = (pageSize: number) => (pageSize <= 200 ? (200 % pageSize === 0 ? 200 : pageSize) : pageSize)

const PICKING = new Set(['picking', 'draft', 'allocated', 'pending_approval', 'confirmed', 'pending_stock'])
const isWaitingApproval = (s: string) => s === 'confirmed_waiting_for_admin_approval' || s === 'pending_approval' || s === 'pending'

function canOrderHaveWaybill(row: OmsOrderListItem): boolean {
  const eligible = ['ready_to_ship', 'shipped', 'out_for_delivery', 'delivered', 'failed_delivery', 'returned', 'cancelled']
  if (!eligible.includes(row.status)) return false
  return Boolean(row.carrier?.trim() || row.trackingNumber?.trim() || row.isManualShipping || row.shippingMethod === 'manual')
}

function qrCopy(action: QrAction | null, ar: boolean): { title: string; hint: string } {
  const t = (en: string, a: string) => (ar ? a : en)
  switch (action) {
    case 'confirm':
      return { title: t('Confirm order by QR', 'تأكيد الطلب بالـ QR'), hint: t('Scan the waybill QR to confirm the order (waiting-for-confirmation only), then scan the next one.', 'امسح QR البوليصة لتأكيد الطلب (بانتظار التأكيد فقط)، ثم امسح الطلب التالي.') }
    case 'approve':
      return { title: t('Approve order by QR', 'اعتماد الطلب بالـ QR'), hint: t('Scan the waybill QR to approve the order (waiting-for-approval only), then scan the next one.', 'امسح QR البوليصة لاعتماد الطلب (بانتظار الاعتماد فقط)، ثم امسح الطلب التالي.') }
    case 'handover':
      return { title: t('Handover to carrier by QR', 'تسليم لشركة الشحن بالـ QR'), hint: t('Scan the waybill QR. A ready-to-ship order is marked out for delivery immediately, then scan the next one.', 'امسح QR البوليصة. الطلب الجاهز للشحن يصبح خارجًا للتسليم فورًا، ثم امسح الطلب التالي.') }
    case 'delivered':
      return { title: t('Mark delivered by QR', 'تسجيل التسليم بالـ QR'), hint: t('Scan the waybill QR to mark the order delivered, then scan the next one.', 'امسح QR البوليصة لتسجيل أن الطلب تم تسليمه، ثم امسح الطلب التالي.') }
    default:
      return { title: t('Mark failed delivery by QR', 'تسجيل تعذر التسليم بالـ QR'), hint: t('Scan the waybill QR to record a failed delivery, then scan the next one.', 'امسح QR البوليصة لتسجيل تعذر التسليم، ثم امسح الطلب التالي.') }
  }
}

type RowAction = { key: string; label: string; onClick: () => void; destructive?: boolean }

export function OmsOrdersListPage() {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const invalidate = () => void qc.invalidateQueries({ queryKey: QK.omsOrders })

  /* ── dialog state ── */
  const [deleteOrder, setDeleteOrder] = useState<OmsOrderListItem | null>(null)
  const [cancelOrder, setCancelOrder] = useState<OmsOrderListItem | null>(null)
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [scanSearchOpen, setScanSearchOpen] = useState(false)
  const [statusScan, setStatusScan] = useState<QrAction | null>(null)
  const [createBatchOpen, setCreateBatchOpen] = useState(false)
  const [addToBatchOpen, setAddToBatchOpen] = useState(false)
  const [editOrderId, setEditOrderId] = useState<string | null>(null)
  const [waybillOrderId, setWaybillOrderId] = useState<string | null>(null)
  const [shipDetailsOrder, setShipDetailsOrder] = useState<OmsOrderListItem | null>(null)
  const [bulkResult, setBulkResult] = useState<{ title: string; result: BulkResult } | null>(null)
  const [exportColumns, setExportColumns] = useState<OmsExportColumnOption[]>([])
  const [exporting, setExporting] = useState(false)
  const [exportingWaybills, setExportingWaybills] = useState(false)
  const [downloadingInstructions, setDownloadingInstructions] = useState<'pdf' | 'zip' | null>(null)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [advancedOpen, setAdvancedOpen] = useCachedState('oms-orders:advanced-open', false)
  const [pageSizeChoice, setPageSizeChoice] = useCachedState<string>('oms-orders:page-size-choice', '50')

  /* ── lookups ── */
  const companiesQuery = useQuery({ queryKey: QK.companies, queryFn: () => CompaniesApi.list(), staleTime: 10 * 60_000 })
  const clientOptions = useMemo(() => companyFilterComboboxOptions(companiesQuery.data, t('All clients', 'كل العملاء')), [companiesQuery.data, isArabic]) // eslint-disable-line react-hooks/exhaustive-deps
  const carrierOptions = useMemo(
    () => [
      { value: '', label: t('All carriers', 'جميع شركات الشحن') },
      { value: 'Babel Express', label: 'Babel Express' },
      { value: 'ترابط', label: isArabic ? 'ترابط' : 'Tarabut (ترابط)' },
      { value: 'ديليفرو جود', label: isArabic ? 'ديليفرو جود' : 'Deliveroo Joud (ديليفرو جود)' },
      { value: 'كرم للشحن', label: isArabic ? 'كرم للشحن' : 'Karam Express (كرم للشحن)' },
      { value: 'مسارات', label: isArabic ? 'مسارات' : 'Masarat (مسارات)' },
      { value: 'مرسال', label: isArabic ? 'مرسال' : 'Mersal (مرسال)' },
      { value: 'تكامل', label: isArabic ? 'تكامل' : 'Takamol (تكامل)' },
    ],
    [isArabic], // eslint-disable-line react-hooks/exhaustive-deps
  )

  /* ── filters (draft / applied) ── */
  const { draftFilters: draftRaw, appliedFilters: appliedRaw, setDraft, applyPatch, applyFilters, resetFilters } =
    useFilters<OmsOrdersListFilters>(OMS_ORDERS_FILTER_DEFAULTS)
  const draft = useMemo(() => normalizeOmsOrdersListFilters(draftRaw), [draftRaw])
  const applied = useMemo(() => normalizeOmsOrdersListFilters(appliedRaw), [appliedRaw])
  const listParams = useMemo(() => buildOmsOrdersListParams(applied), [applied])
  const navCountParams = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { status: _s, operationalStage: _o, ...rest } = listParams
    return rest
  }, [listParams])
  const navCounts = useQuery({ queryKey: [...QK.omsOrders, 'nav-counts', navCountParams], queryFn: () => OmsApi.statusNavCounts(navCountParams) })

  const pageSize = PAGE_SIZES.includes(Number(pageSizeChoice)) ? Number(pageSizeChoice) : 50
  const pagination = useChunkedServerPagination<OmsOrderListItem>({
    chunkSize: resolveChunkSize(pageSize),
    pageSize,
    filterKey: listParams,
    fetchChunk: (offset, limit) => OmsApi.list({ ...listParams, offset, limit }),
    rtQueryKeyPrefix: QK.omsOrders,
    chunkQueryKeyPrefix: 'oms-orders-chunk',
  })

  const advancedActive = countAppliedOmsAdvancedFilters({ ...applied, status: '' })
  const clientName = companiesQuery.data?.find((c) => c.id === applied.companyId)?.name ?? null
  const appliedSummary = useMemo(() => buildOmsAppliedFilterSummary(applied, { clientName, isArabic }), [applied, clientName, isArabic])
  const rangeError = useMemo(() => validateOmsOrderRange(draft.startOrderNo, draft.endOrderNo, isArabic), [draft.startOrderNo, draft.endOrderNo, isArabic])

  const onApply = () => {
    if (rangeError) return
    if (advancedOpen) applyPatch({ ...draft, orderSearch: '' })
    else applyFilters()
  }
  const onReset = () => {
    resetFilters()
    setAdvancedOpen(false)
  }

  useEffect(() => {
    void OmsApi.exportColumns().then(setExportColumns).catch(() => setExportColumns([]))
  }, [])
  useEffect(() => setSelectedIds(new Set()), [listParams])

  /* ── selection ── */
  const rowSelection = useMemo<RowSelectionState>(() => Object.fromEntries([...selectedIds].map((id) => [id, true])), [selectedIds])
  const onRowSelectionChange: OnChangeFn<RowSelectionState> = (updater) => {
    const next = typeof updater === 'function' ? updater(rowSelection) : updater
    setSelectedIds(new Set(Object.keys(next).filter((k) => next[k])))
  }
  const selectedOrders = useMemo(() => pagination.rows.filter((r) => selectedIds.has(r.id)), [pagination.rows, selectedIds])
  const cancellableSelected = useMemo(() => selectedOrders.filter((o) => isOmsAdminCancellableStatus(o.status) && o.status !== 'cancelled'), [selectedOrders])
  const waybillEligible = useMemo(() => selectedOrders.filter(canOrderHaveWaybill), [selectedOrders])
  const instructionEligible = useMemo(() => selectedOrders.filter((o) => mapOmsCommercialDisplayStatus(o.status) === 'processing'), [selectedOrders])

  /* ── single-order mutations ── */
  const useSimpleMutation = (fn: (id: string) => Promise<unknown>, okEn: string, okAr: string, extra?: () => void) =>
    useMutation({
      mutationFn: fn,
      onSuccess: () => {
        toast.success(t(okEn, okAr))
        extra?.()
        invalidate()
      },
      onError: (e: Error) => toast.error(e.message),
    })
  const confirmMut = useSimpleMutation((id) => OmsApi.confirm(id), 'Order confirmed (waiting for admin approval).', 'تم تأكيد الطلب بنجاح (بانتظار موافقة الإدارة).')
  const approveMut = useSimpleMutation((id) => OmsApi.approve(id), 'Order approved and moved to processing.', 'تمت الموافقة على الطلب وتحويله للمعالجة.')
  const pickingMut = useSimpleMutation((id) => OutboundApi.completePicking(id), 'Picking completed.', 'تم إكمال مرحلة الالتقاط بنجاح.')
  const packingMut = useSimpleMutation((id) => OutboundApi.completePacking(id), 'Packing completed.', 'تم إكمال مرحلة التعبئة بنجاح.')
  const shippingMut = useSimpleMutation((id) => OutboundApi.completeShippingDetails(id), 'Shipping marked complete.', 'تم تأكيد اكتمال الشحن، الطلب جاهز للشحن.')
  const dispatchMut = useSimpleMutation((id) => OutboundApi.completeDispatch(id), 'Dispatch completed (out for delivery).', 'تم إكمال الإرسال وخروج الشحنة للتسليم.')
  const deliveredMut = useSimpleMutation((id) => OmsApi.delivered(id), 'Order marked as delivered.', 'تم تأكيد تسليم الطلب للعميل.')
  const failedMut = useSimpleMutation((id) => OmsApi.failedDelivery(id), 'Order marked as failed delivery.', 'تم تسجيل تعذر تسليم الطلب.', () => void qc.invalidateQueries({ queryKey: ['oms-returns'] }))
  const returnedMut = useSimpleMutation((id) => OmsApi.returned(id), 'Return request created (awaiting confirmation in Returns).', 'تم إنشاء طلب الإرجاع (بانتظار التأكيد في صفحة المرتجعات).', () => void qc.invalidateQueries({ queryKey: ['oms-returns'] }))
  const cancelMut = useMutation({
    mutationFn: (id: string) => OmsApi.cancel(id),
    onSuccess: () => {
      toast.success(t('Order cancelled.', 'تم إلغاء الطلب بنجاح.'))
      setCancelOrder(null)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => OmsApi.delete(id),
    onSuccess: () => {
      toast.success(t('Order deleted.', 'تم حذف الطلب.'))
      setDeleteOrder(null)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  /* ── bulk / downloads ── */
  const handleBulkCancel = async () => {
    const ids = cancellableSelected.map((o) => o.id)
    if (!ids.length) return
    setLoadingAction('cancel')
    setBulkCancelOpen(false)
    try {
      const result = await OmsApi.cancelBulk(ids)
      setBulkResult({ title: t('Bulk cancel results', 'نتائج إلغاء الطلبات'), result })
      invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Bulk cancel failed.', 'فشل الإلغاء الجماعي.'))
    } finally {
      setLoadingAction(null)
    }
  }
  const onExportSubmit = async (payload: { columnIds: string[]; arabicHeaders: boolean }) => {
    if (exporting) return
    setExporting(true)
    try {
      await OmsApi.exportDownloadPost({ ...listParams, ...payload, ids: selectedIds.size > 0 ? [...selectedIds] : undefined })
      setExportOpen(false)
      toast.success(t('Exported OMS orders to CSV.', 'تم تنزيل ملف CSV.'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Export failed.', 'فشل التصدير.'))
    } finally {
      setExporting(false)
    }
  }
  const exportWaybills = async () => {
    if (exportingWaybills || selectedIds.size === 0) return
    setExportingWaybills(true)
    try {
      await OmsApi.exportWaybillsExcel([...selectedIds])
      toast.success(t('Waybills exported to Excel.', 'تم تصدير بوالص الشحن (Excel).'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Failed to export waybills.', 'فشل تصدير بوالص الشحن'))
    } finally {
      setExportingWaybills(false)
    }
  }
  const downloadInstructions = async (order: OmsOrderListItem) => {
    try {
      await OmsApi.downloadInstructionPdf(order.id, order.orderNumber)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Could not download the instructions PDF.', 'تعذر تنزيل تعليمات التنفيذ.'))
    }
  }
  const downloadInstructionsBulk = async (mode: 'pdf' | 'zip') => {
    if (downloadingInstructions || instructionEligible.length === 0) return
    const skipped = selectedOrders.length - instructionEligible.length
    setDownloadingInstructions(mode)
    try {
      const ids = instructionEligible.map((o) => o.id)
      if (mode === 'pdf') await OmsApi.downloadInstructionsPdf(ids)
      else await OmsApi.downloadInstructionsZip(ids)
      const note = skipped > 0 ? t(` Skipped ${skipped} order(s) that are not in processing.`, ` تم تجاهل ${skipped} طلب لأنها ليست قيد المعالجة.`) : ''
      toast.success((mode === 'pdf' ? t('Instructions PDF downloaded.', 'تم تنزيل ملف التعليمات.') : t('Instructions ZIP downloaded.', 'تم تنزيل ملف التعليمات المضغوط.')) + note)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Could not download instructions.', 'تعذر تنزيل تعليمات التنفيذ.'))
    } finally {
      setDownloadingInstructions(null)
    }
  }

  /* ── QR status scan (same transitions as classic) ── */
  const handleStatusScan = async (raw: string): Promise<OmsScanResult> => {
    const kind = statusScan
    if (!kind) return { ok: false, message: '' }
    const code = normalizeWaybillScan(raw)
    if (!code) return { ok: false, message: t('The scanned code is empty.', 'الرمز فارغ.') }

    let order: OmsOrderListItem | undefined
    for (const attempt of waybillScanAttempts(code)) {
      const page = await OmsApi.list({ orderSearch: attempt, limit: 25 })
      const exact = page.items.filter((i) => orderMatchesWaybillScan(i, code) || orderMatchesWaybillScan(i, attempt))
      if (exact.length > 1) return { ok: false, message: t(`${code} matches more than one order.`, `الرمز ${code} يطابق أكثر من طلب.`) }
      if (exact.length === 1) {
        order = exact[0]
        break
      }
    }
    if (!order) return { ok: false, message: t(`No order found for ${code}.`, `لا يوجد طلب للرمز ${code}.`) }

    const label = order.orderNumber
    const wrong = (en: string, ar: string): OmsScanResult => ({ ok: false, message: `${label} ${isArabic ? ar : en}` })
    const done = (en: string, ar: string): OmsScanResult => {
      invalidate()
      return { ok: true, message: `${label} — ${isArabic ? ar : en}` }
    }
    try {
      if (kind === 'confirm') {
        if (order.status !== 'waiting_for_confirmation') return wrong('is not waiting for confirmation.', 'ليس بانتظار التأكيد.')
        await OmsApi.confirm(order.id)
        return done('confirmed', 'تم التأكيد')
      }
      if (kind === 'approve') {
        if (!isWaitingApproval(order.status)) return wrong('is not waiting for approval.', 'ليس بانتظار الاعتماد.')
        await OmsApi.approve(order.id)
        return done('approved', 'تم الاعتماد')
      }
      if (kind === 'handover') {
        if (order.status !== 'ready_to_ship') return wrong('is not ready to ship.', 'ليس جاهزًا للشحن.')
        const outboundId = order.outboundOrderId ?? order.linkedOutboundOrder?.id
        if (!outboundId) return wrong('has no warehouse order.', 'غير مرتبط بطلب مستودع.')
        await OutboundApi.completeDispatch(outboundId, order.companyId)
        return done('out for delivery', 'خرج للتسليم')
      }
      if (!(order.status === 'shipped' || order.status === 'out_for_delivery')) return wrong('is not out for delivery.', 'ليس خارجًا للتسليم.')
      if (kind === 'delivered') {
        await OmsApi.delivered(order.id)
        return done('delivered', 'تم التسليم')
      }
      await OmsApi.failedDelivery(order.id)
      void qc.invalidateQueries({ queryKey: ['oms-returns'] })
      return done('failed delivery', 'تعذر التسليم')
    } catch (error) {
      // Backend transition errors surface verbatim.
      return { ok: false, message: error instanceof Error ? error.message : t(`Could not update ${label}.`, `تعذر تحديث ${label}.`) }
    }
  }

  /* ── row actions ── */
  const actionsFor = (row: OmsOrderListItem): RowAction[] => {
    const outboundId = row.outboundOrderId ?? row.linkedOutboundOrder?.id
    const ob = row.linkedOutboundOrder?.status
    const items: RowAction[] = []
    const add = (a: RowAction) => items.push(a)

    if (row.status === 'waiting_for_confirmation') {
      add({ key: 'confirm', label: t('Confirm', 'تأكيد الطلب'), onClick: () => confirmMut.mutate(row.id) })
      add({ key: 'cancel', label: t('Cancel order', 'إلغاء الطلب'), destructive: true, onClick: () => setCancelOrder(row) })
    }
    if (isWaitingApproval(row.status)) {
      if (!row.needsInformation) add({ key: 'approve', label: t('Approve', 'اعتماد الطلب'), onClick: () => approveMut.mutate(row.id) })
      add({ key: 'cancel', label: t('Cancel order', 'إلغاء الطلب'), destructive: true, onClick: () => setCancelOrder(row) })
    }
    if (mapOmsCommercialDisplayStatus(row.status) === 'processing') {
      add({ key: 'instructions', label: t('Instructions PDF', 'تعليمات التنفيذ PDF'), onClick: () => void downloadInstructions(row) })
    }
    if (row.status === 'processing' && outboundId) {
      if (ob && PICKING.has(ob)) add({ key: 'picking', label: t('Mark picking as complete', 'إكمال مرحلة الالتقاط'), onClick: () => pickingMut.mutate(outboundId) })
      else if (ob === 'packing') add({ key: 'packing', label: t('Mark packing as complete', 'إكمال مرحلة التعبئة'), onClick: () => packingMut.mutate(outboundId) })
      else if (ob === 'waiting_for_shipping_method' || ob === 'waiting_for_shipping_details') {
        const sent = Boolean(row.trackingNumber?.trim() || row.linkedOutboundOrder?.trackingNumber?.trim() || row.linkedOutboundOrder?.hasCarrierShipment)
        if (sent) add({ key: 'shipConfirm', label: t('Confirm shipping complete', 'تأكيد اكتمال الشحن'), onClick: () => shippingMut.mutate(outboundId) })
        else add({ key: 'shipDetails', label: t('Complete shipping details', 'إكمال تفاصيل الشحن'), onClick: () => setShipDetailsOrder(row) })
      }
    }
    if (row.status === 'ready_to_ship' && outboundId) {
      add({ key: 'dispatch', label: t('Mark dispatch as complete', 'إكمال الإرسال والخروج للتسليم'), onClick: () => dispatchMut.mutate(outboundId) })
    }
    if (row.status === 'shipped' || row.status === 'out_for_delivery') {
      add({ key: 'delivered', label: t('Mark as delivered', 'تم التسليم بنجاح'), onClick: () => deliveredMut.mutate(row.id) })
      add({ key: 'failed', label: t('Mark as failed delivery', 'تعذر التسليم'), onClick: () => failedMut.mutate(row.id) })
    } else if (row.status === 'failed_delivery') {
      add({ key: 'returned', label: t('Mark as return', 'تحويل لمرتجع'), onClick: () => returnedMut.mutate(row.id) })
    }
    if (isOmsAdminCancellableStatus(row.status) && row.status !== 'cancelled' && row.status !== 'waiting_for_confirmation' && !isWaitingApproval(row.status)) {
      add({ key: 'cancel2', label: t('Cancel order', 'إلغاء الطلب'), destructive: true, onClick: () => setCancelOrder(row) })
    }
    add({ key: 'edit', label: t('Edit', 'تعديل'), onClick: () => setEditOrderId(row.id) })
    if (canOrderHaveWaybill(row)) add({ key: 'waybill', label: t('Shipping waybill (print / PDF)', 'بوليصة الشحن (طباعة / PDF)'), onClick: () => setWaybillOrderId(row.id) })
    if (row.status === 'delivered' || row.status === 'completed') {
      add({ key: 'fee', label: t('Specify shipping fee', 'تحديد رسوم الشحن'), onClick: () => navigate(`/orders/oms/${row.id}`, { state: { openShippingFee: true } }) })
    }
    if (isOmsOrderDeletable(row.status)) add({ key: 'delete', label: t('Delete', 'حذف'), destructive: true, onClick: () => setDeleteOrder(row) })
    return items
  }

  /* ── columns (priority drives responsive behaviour) ── */
  const showStage = shouldShowOmsStageColumn(applied.status)
  const columns = useMemo<ColumnDef<OmsOrderListItem>[]>(
    () => [
      { id: 'orderNumber', header: t('Order #', 'رقم الطلب'), cell: ({ row }) => <span className="font-medium tabular">{row.original.orderNumber}</span>, meta: { priority: 1, className: 'min-w-32' } },
      { id: 'client', header: t('Client', 'العميل'), cell: ({ row }) => row.original.company?.name?.trim() || '—', meta: { priority: 1, className: 'min-w-24' } },
      { id: 'customer', header: t('Customer', 'الزبون'), cell: ({ row }) => row.original.recipientName?.trim() || '—', meta: { priority: 1, className: 'min-w-28' } },
      { id: 'phone', header: t('Phone', 'الهاتف'), cell: ({ row }) => <bdi className="tabular">{row.original.recipientPhone?.trim() || '—'}</bdi>, meta: { priority: 2, className: 'min-w-28' } },
      { id: 'city', header: t('City', 'المدينة'), cell: ({ row }) => row.original.city?.trim() || '—', meta: { priority: 3, className: 'min-w-24' } },
      {
        id: 'carrier',
        header: t('Carrier', 'شركة الشحن'),
        cell: ({ row: { original: o } }) => (
          <OmsCarrierCell carrier={o.shippingCarrierName || o.carrier} shippingMethod={o.shippingMethod} isManualShipping={o.isManualShipping} outboundStatus={o.linkedOutboundOrder?.status} isArabic={isArabic} />
        ),
        meta: { priority: 2, className: 'min-w-36' },
      },
      { id: 'total', header: t('Total', 'الإجمالي'), cell: ({ row: { original: o } }) => <span className="tabular">{o.total ? `${o.total}${o.currency ? ` ${o.currency}` : ''}` : '—'}</span>, meta: { priority: 2, align: 'end', className: 'min-w-20' } },
      { id: 'status', header: t('Status', 'الحالة'), cell: ({ row: { original: o } }) => <OmsStatusBadge status={o.status} isArabic={isArabic} needsInformation={o.needsInformation} />, meta: { priority: 1, className: 'min-w-32' } },
      ...(showStage
        ? [{
            id: 'stage',
            header: t('Stage', 'المرحلة'),
            cell: ({ row: { original: o } }: { row: { original: OmsOrderListItem } }) => (orderOperationalStage(o) ? <OmsStageBadge order={o} isArabic={isArabic} /> : <span className="text-muted-foreground">—</span>),
            meta: { priority: 2 as const, className: 'min-w-36' },
          } satisfies ColumnDef<OmsOrderListItem>]
        : []),
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('Actions', 'الإجراءات')}</span>,
        cell: ({ row: { original: o } }) => {
          const items = actionsFor(o)
          return (
            <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" aria-label={t(`Actions for ${o.orderNumber}`, `إجراءات ${o.orderNumber}`)}>
                    <MoreHorizontal aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-56">
                  {items.map((a, i) => (
                    <div key={a.key}>
                      {a.destructive && i > 0 && !items[i - 1].destructive ? <DropdownMenuSeparator /> : null}
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
        meta: { priority: 1, align: 'end', className: 'w-14 min-w-14', cardAction: true },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isArabic, showStage, pagination.rows],
  )

  const qrButtons: { key: QrAction; label: string; variant: 'outline' | 'default' | 'secondary' }[] = [
    { key: 'confirm', label: t('Confirm by QR', 'تأكيد بالـ QR'), variant: 'outline' },
    { key: 'approve', label: t('Approve by QR', 'اعتماد بالـ QR'), variant: 'outline' },
    { key: 'handover', label: t('Handover by QR', 'تسليم بالـ QR'), variant: 'secondary' },
    { key: 'delivered', label: t('Delivered by QR', 'تم التسليم بالـ QR'), variant: 'secondary' },
    { key: 'failed', label: t('Failed delivery by QR', 'تعذر التسليم بالـ QR'), variant: 'outline' },
  ]

  const field = (label: string, node: React.ReactNode, id?: string) => (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {node}
    </div>
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('OMS Orders', 'طلبات OMS')}
        description={t('Manage e-commerce and OMS fulfilment orders.', 'إدارة طلبات التجارة الإلكترونية وطلبات OMS.')}
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
            <Button onClick={() => navigate('/orders/oms/new')}>
              <Plus aria-hidden />
              {t('Create OMS order', 'إنشاء طلب OMS')}
            </Button>
          </>
        }
      />

      {/* Filters */}
      <section aria-label={t('Filters', 'التصفية')} className="space-y-3 rounded-xl border bg-card p-3">
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            onApply()
          }}
        >
          <SearchInput
            value={draft.orderSearch}
            onChange={(v) => setDraft({ orderSearch: v })}
            placeholder={t('Search orders, clients, customers, phone…', 'بحث: رقم الطلب، العملاء، الزبائن، الهاتف…')}
            clearLabel={t('Clear search', 'مسح البحث')}
          />
          <Button type="button" variant="outline" onClick={() => setScanSearchOpen(true)}>
            <QrCode aria-hidden />
            {t('Scan QR', 'مسح QR')}
          </Button>
          <Button type="button" variant={advancedOpen ? 'secondary' : 'outline'} aria-expanded={advancedOpen} onClick={() => setAdvancedOpen(!advancedOpen)}>
            <SlidersHorizontal aria-hidden />
            {t('Advanced filters', 'تصفية متقدمة')}
            {advancedActive > 0 ? <Badge className="ms-1">{advancedActive}</Badge> : null}
          </Button>
          <div className="ms-auto flex items-center gap-2">
            <ResetFiltersButton label={t('Reset', 'إعادة تعيين')} onClick={onReset} />
            <Button type="submit" disabled={Boolean(rangeError) || pagination.isFetching}>
              {pagination.isFetching ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {t('Apply', 'تطبيق')}
            </Button>
          </div>
        </form>

        {advancedOpen ? (
          <div className="grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-3">
            {field(t('Order ID', 'رقم الطلب'), <Input id="f-order-id" value={draft.orderId} onChange={(e) => setDraft({ orderId: e.target.value })} placeholder={t('Order # or reference…', 'رقم الطلب أو المرجع…')} />, 'f-order-id')}
            {field(t('Start order no.', 'رقم طلب البداية'), <Input id="f-start" value={draft.startOrderNo} onChange={(e) => setDraft({ startOrderNo: e.target.value })} placeholder="OMS-2026-03700" />, 'f-start')}
            {field(t('End order no.', 'رقم طلب النهاية'), <Input id="f-end" value={draft.endOrderNo} onChange={(e) => setDraft({ endOrderNo: e.target.value })} placeholder="OMS-2026-03800" />, 'f-end')}
            {rangeError ? (
              <p role="alert" className="col-span-full rounded-lg border border-tone-danger-border bg-tone-danger-bg px-3 py-2 text-sm text-tone-danger-fg">{rangeError}</p>
            ) : null}
            {field(t('Client', 'العميل'), <Combobox id="f-client" value={draft.companyId} onChange={(v) => setDraft({ companyId: v })} options={clientOptions} placeholder={t('Search client…', 'ابحث عن عميل…')} searchPlaceholder={t('Search…', 'بحث…')} emptyLabel={t('No results', 'لا نتائج')} />, 'f-client')}
            {field(t('Customer', 'الزبون'), <Input id="f-customer" value={draft.customer} onChange={(e) => setDraft({ customer: e.target.value })} placeholder={t('Customer name…', 'اسم الزبون…')} />, 'f-customer')}
            {field(t('Phone', 'الهاتف'), <Input id="f-phone" inputMode="tel" value={draft.phone} onChange={(e) => setDraft({ phone: e.target.value })} placeholder={t('Phone…', 'رقم الهاتف…')} />, 'f-phone')}
            {field(t('City', 'المدينة'), <Input id="f-city" value={draft.city} onChange={(e) => setDraft({ city: e.target.value })} placeholder={t('City…', 'المدينة…')} />, 'f-city')}
            {field(t('Carrier', 'شركة الشحن'), <Combobox id="f-carrier" value={draft.carrier} onChange={(v) => setDraft({ carrier: v })} options={carrierOptions} placeholder={t('Select carrier…', 'اختر شركة الشحن…')} searchPlaceholder={t('Search…', 'بحث…')} emptyLabel={t('No results', 'لا نتائج')} />, 'f-carrier')}
            {field(
              t('Total / cost', 'الإجمالي / التكلفة'),
              <div className="grid grid-cols-[1.2fr_1fr] gap-2">
                <Select value={draft.totalOp || 'gte'} onValueChange={(v) => setDraft({ totalOp: v as OmsTotalOperator })}>
                  <SelectTrigger aria-label={t('Total operator', 'عامل الإجمالي')} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OMS_TOTAL_OPERATOR_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="number" min={0} step="0.01" inputMode="decimal" value={draft.totalValue} onChange={(e) => setDraft({ totalValue: e.target.value })} placeholder="0" aria-label={t('Total value', 'قيمة الإجمالي')} />
              </div>,
            )}
          </div>
        ) : null}

        {appliedSummary ? <p className="text-sm text-muted-foreground">{t('Applied:', 'مطبّق:')} {appliedSummary}</p> : null}
      </section>

      {/* Status cards = filters */}
      <OmsStatusNav
        isArabic={isArabic}
        status={applied.status}
        operationalStage={applied.operationalStage}
        counts={navCounts.data}
        onStatusChange={(status) => applyPatch({ status, operationalStage: '' })}
        onStageChange={(operationalStage) => applyPatch({ operationalStage })}
      />

      {/* Action by QR */}
      <FilterBar className="gap-2">
        <span className="me-1 inline-flex items-center gap-1.5 text-sm font-medium">
          <QrCode className="size-4 text-primary" aria-hidden />
          {t('Action by QR', 'إجراء بالـ QR')}
        </span>
        {qrButtons.map((b) => (
          <Button key={b.key} type="button" variant={b.variant} onClick={() => setStatusScan(b.key)}>
            {b.label}
          </Button>
        ))}
        <span className="basis-full text-sm text-muted-foreground lg:basis-auto lg:ms-auto">
          {t('Choose an action, then scan the order waybill. Only the next valid transition is allowed.', 'اختر الإجراء ثم امسح بوليصة الطلب. يُسمح فقط بالانتقال التالي الصحيح للحالة.')}
        </span>
      </FilterBar>

      {/* Selection toolbar */}
      {selectedIds.size > 0 ? (
        <div role="region" aria-label={t('Selected orders', 'الطلبات المحددة')} className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-secondary p-2">
          <span className="px-2 text-sm font-medium"><Badge className="me-2 tabular">{selectedIds.size}</Badge>{t('selected', 'محدد')}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => (selectedIds.size > 1000 ? toast.error(t('You can create a batch with up to 1000 orders at once.', 'يمكن إنشاء مجموعة من حتى 1000 طلب في المرة الواحدة.')) : setCreateBatchOpen(true))}
          >
            <Layers aria-hidden />
            {t('Create batch', 'إنشاء مجموعة')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => (selectedIds.size > 1000 ? toast.error(t('You can add up to 1000 orders to a batch at once.', 'يمكن إضافة حتى 1000 طلب إلى مجموعة في المرة الواحدة.')) : setAddToBatchOpen(true))}
          >
            <FolderPlus aria-hidden />
            {t('Add to existing batch', 'إضافة إلى مجموعة موجودة')}
          </Button>
          {instructionEligible.length > 0 ? (
            <>
              <Button variant="outline" size="sm" disabled={!!downloadingInstructions} onClick={() => void downloadInstructionsBulk('pdf')}>
                <FileDown aria-hidden />
                {t(`Instructions PDF (${instructionEligible.length})`, `تعليمات PDF (${instructionEligible.length})`)}
              </Button>
              <Button variant="outline" size="sm" disabled={!!downloadingInstructions} onClick={() => void downloadInstructionsBulk('zip')}>
                <FileDown aria-hidden />
                {t(`Instructions ZIP (${instructionEligible.length})`, `تعليمات ZIP (${instructionEligible.length})`)}
              </Button>
            </>
          ) : null}
          {waybillEligible.length > 0 ? (
            <Button variant="outline" size="sm" disabled={exportingWaybills} onClick={() => void exportWaybills()}>
              {exportingWaybills ? <Loader2 className="animate-spin" aria-hidden /> : <FileDown aria-hidden />}
              {t(`Export waybills (${waybillEligible.length})`, `تصدير بوالص الشحن (${waybillEligible.length})`)}
            </Button>
          ) : null}
          {cancellableSelected.length > 0 ? (
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" disabled={!!loadingAction} onClick={() => setBulkCancelOpen(true)}>
              <Ban aria-hidden />
              {t(`Cancel all (${cancellableSelected.length})`, `إلغاء الكل (${cancellableSelected.length})`)}
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" className="ms-auto" onClick={() => setSelectedIds(new Set())}>
            <X aria-hidden />
            {t('Clear selection', 'إلغاء التحديد')}
          </Button>
        </div>
      ) : null}

      {/* Table */}
      <DataTable<OmsOrderListItem>
        columns={columns}
        data={pagination.rows}
        getRowId={(r) => r.id}
        loading={pagination.isInitialLoading}
        stateOverride={
          pagination.isError ? (
            <div role="alert" className={cn('rounded-xl border border-tone-danger-border bg-tone-danger-bg p-4 text-sm text-tone-danger-fg')}>
              {(pagination.error as Error)?.message || t('Failed to load orders.', 'تعذر تحميل الطلبات.')}
            </div>
          ) : undefined
        }
        empty={t('No OMS orders match the filters.', 'لا توجد طلبات OMS مطابقة للتصفية.')}
        rowSelection={rowSelection}
        onRowSelectionChange={onRowSelectionChange}
        onRowClick={(r) => navigate(`/orders/oms/${r.id}`)}
        pagination={{
          page: pagination.page,
          pageSize,
          total: pagination.total,
          pageSizeOptions: PAGE_SIZES.filter((s) => s <= MAX_PAGE_SIZE),
          onPageChange: pagination.setPage,
          onPageSizeChange: (size) => {
            setPageSizeChoice(String(size))
            pagination.resetPage()
          },
        }}
        labels={{ rowsPerPage: t('Rows per page', 'عدد الصفوف في الصفحة'), of: t('of', 'من'), noResults: t('No results', 'لا نتائج'), select: t('Select row', 'تحديد الصف'), selectAll: t('Select all on page', 'تحديد الكل في الصفحة') }}
      />

      {/* Dialogs */}
      <OmsImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImported={invalidate} isArabic={isArabic} />
      <OmsExportDialog open={exportOpen} onClose={() => !exporting && setExportOpen(false)} columns={exportColumns} exporting={exporting} onExport={(p) => void onExportSubmit(p)} isArabic={isArabic} />
      <OmsCreateBatchDialog open={createBatchOpen} selectedIds={[...selectedIds]} loadedOrders={pagination.rows} isArabic={isArabic} onClose={() => setCreateBatchOpen(false)} />
      <OmsAddToBatchDialog open={addToBatchOpen} selectedIds={[...selectedIds]} isArabic={isArabic} onClose={() => setAddToBatchOpen(false)} />
      <OmsOrderFormDialog open={editOrderId != null} orderId={editOrderId} onOpenChange={(o) => { if (!o) setEditOrderId(null) }} onSaved={() => { invalidate(); setEditOrderId(null) }} isArabic={isArabic} />
      <OmsWaybillDialog open={waybillOrderId != null} orderId={waybillOrderId} onClose={() => setWaybillOrderId(null)} />
      <OmsBulkShippingDetailsDialog open={shipDetailsOrder != null} orders={shipDetailsOrder ? [shipDetailsOrder] : []} isArabic={isArabic} onClose={() => setShipDetailsOrder(null)} onSuccess={() => { invalidate(); setShipDetailsOrder(null) }} />
      {bulkResult ? <BulkResultDialog open title={bulkResult.title} result={bulkResult.result} onClose={() => setBulkResult(null)} isArabic={isArabic} /> : null}

      <OmsScanDialog
        open={scanSearchOpen}
        onClose={() => setScanSearchOpen(false)}
        isArabic={isArabic}
        onScan={(code) => {
          applyPatch({ orderSearch: code })
          toast.success(t(`Filtered orders for: ${code}`, `تم تطبيق البحث عن: ${code}`))
        }}
      />
      <OmsScanDialog
        open={statusScan !== null}
        keepOpen
        isArabic={isArabic}
        title={qrCopy(statusScan, isArabic).title}
        hint={qrCopy(statusScan, isArabic).hint}
        submitLabel={t('Record', 'تسجيل')}
        onClose={() => setStatusScan(null)}
        onScan={handleStatusScan}
      />

      {/* The single confirmation modal: Cancel / Delete */}
      <ConfirmDialog
        open={cancelOrder !== null}
        onOpenChange={(o) => !o && !cancelMut.isPending && setCancelOrder(null)}
        intent="danger"
        title={t(`Cancel order ${cancelOrder?.orderNumber ?? ''}?`, `هل أنت متأكد من إلغاء الطلب ${cancelOrder?.orderNumber ?? ''}؟`)}
        description={t('The order will be marked cancelled and its shipment will not be fulfilled.', 'سيتم تحويل حالة الطلب إلى ملغي ولن يتم تنفيذ الشحنة.')}
        confirmLabel={t('Cancel order', 'إلغاء الطلب')}
        cancelLabel={t('Keep order', 'تراجع')}
        loading={cancelMut.isPending}
        onConfirm={() => {
          if (cancelOrder) cancelMut.mutate(cancelOrder.id)
        }}
      />
      <ConfirmDialog
        open={deleteOrder !== null}
        onOpenChange={(o) => !o && !deleteMut.isPending && setDeleteOrder(null)}
        intent="danger"
        title={t('Delete OMS order?', 'حذف طلب OMS؟')}
        description={deleteOrder ? t(`Delete ${deleteOrder.orderNumber}? This cannot be undone.`, `حذف ${deleteOrder.orderNumber}؟ لا يمكن التراجع عن هذا الإجراء.`) : undefined}
        confirmLabel={t('Delete', 'حذف')}
        cancelLabel={t('Cancel', 'إلغاء')}
        loading={deleteMut.isPending}
        onConfirm={() => {
          if (deleteOrder) deleteMut.mutate(deleteOrder.id)
        }}
      />
      <ConfirmDialog
        open={bulkCancelOpen}
        onOpenChange={(o) => !o && loadingAction !== 'cancel' && setBulkCancelOpen(false)}
        intent="danger"
        title={t(`Cancel ${cancellableSelected.length} order(s)?`, `إلغاء ${cancellableSelected.length} طلب؟`)}
        description={t(`All selected cancellable orders (${cancellableSelected.length}) will be marked cancelled.`, `سيتم إلغاء كافة الطلبات المحددة القابلة للإلغاء (${cancellableSelected.length} طلب).`)}
        confirmLabel={t('Cancel orders', 'إلغاء الطلبات')}
        cancelLabel={t('Keep orders', 'تراجع')}
        loading={loadingAction === 'cancel'}
        onConfirm={() => void handleBulkCancel()}
      />
    </div>
  )
}
