import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table'
import { ArrowLeft, Flag, Loader2, MoreHorizontal, Receipt, Trash2 } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { useUiPreferences } from '@emdad/core'
import {
  ConfirmDialog,
  DataTable,
  ErrorState,
  KpiCard,
  KpiStrip,
  PageHeader,
  SearchInput,
  useNavigate,
} from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@emdad/ui/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@emdad/ui/ui/dropdown-menu'
import { Progress } from '@emdad/ui/ui/progress'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { Textarea } from '@emdad/ui/ui/textarea'
import { OmsApi, type OmsBatchOrderRow, type OmsOrderListItem } from '@/api/oms'
import { OutboundApi, type BulkIdsResponse } from '@/api/outbound'
import { QK } from '@/constants/query-keys'
import { runInChunks } from '@/lib/chunk-ids'
import { isOmsAdminCancellableStatus } from '@/lib/oms-order-cancel'
import { omsOperationalStageLabel } from '@/lib/oms-operational-stage'
import { OmsBulkShippingDetailsDialog } from './OmsBulkShippingDetailsDialog'
import { OmsCarrierCell, OmsStageBadge, OmsStatusBadge } from './oms-ui'
import { OmsWaybillDialog } from './OmsWaybillDialog'

const CHUNK = 100
const ISSUE_STATUSES = new Set(['failed_delivery', 'cancelled', 'rejected', 'returned'])

const CONFIRMED_SHIPPING = new Set([
  'ready_to_ship',
  'shipped',
  'out_for_delivery',
  'delivered',
  'failed_delivery',
  'returned',
])

function outboundId(order: OmsOrderListItem): string | null {
  return order.outboundOrderId ?? order.linkedOutboundOrder?.id ?? null
}

function labelReadiness(order: OmsOrderListItem): 'ready' | 'missing' | 'unconfirmed' {
  const confirmed =
    CONFIRMED_SHIPPING.has(order.status) ||
    CONFIRMED_SHIPPING.has(order.linkedOutboundOrder?.status ?? '')
  if (!confirmed) return 'unconfirmed'
  return 'ready'
}

function shipmentSent(order: OmsOrderListItem) {
  return Boolean(
    order.trackingNumber?.trim() ||
      order.linkedOutboundOrder?.trackingNumber?.trim() ||
      order.linkedOutboundOrder?.hasCarrierShipment,
  )
}

export function OmsBatchDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [shippingOpen, setShippingOpen] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)
  const [issueNote, setIssueNote] = useState('')
  const [search, setSearch] = useState('')
  const [waybillOrderId, setWaybillOrderId] = useState<string | null>(null)
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)

  const query = useQuery({
    queryKey: QK.omsBatch(id),
    queryFn: () => OmsApi.getBatch(id),
    enabled: Boolean(id),
  })

  const batch = query.data
  const orders = useMemo(() => (batch?.orders ?? []).map((row) => row.order), [batch])
  const selectedIds = useMemo(() => Object.keys(rowSelection).filter((k) => rowSelection[k]), [rowSelection])

  const scoped = useMemo(() => {
    if (!selectedIds.length) return orders
    const set = new Set(selectedIds)
    return orders.filter((order) => set.has(order.id))
  }, [orders, selectedIds])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const source = batch?.orders ?? []
    if (!q) return source
    return source.filter((row) => {
      const hay = `${row.order.orderNumber} ${row.order.recipientName ?? ''} ${row.order.company?.name ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [batch, search])

  const waitingConfirm = scoped.filter((order) => order.status === 'waiting_for_confirmation')
  const waitingApproval = scoped.filter(
    (order) =>
      order.status === 'confirmed_waiting_for_admin_approval' ||
      order.status === 'pending_approval' ||
      order.status === 'pending',
  )
  const picking = scoped.filter((order) => {
    const outbound = order.linkedOutboundOrder?.status
    return (
      order.status === 'processing' &&
      (outbound === 'picking' ||
        outbound === 'draft' ||
        outbound === 'allocated' ||
        outbound === 'pending_approval' ||
        outbound === 'confirmed' ||
        outbound === 'pending_stock')
    )
  })
  const packing = scoped.filter(
    (order) => order.status === 'processing' && order.linkedOutboundOrder?.status === 'packing',
  )
  const shippingDetails = scoped.filter((order) => {
    const outbound = order.linkedOutboundOrder?.status
    const stage = outbound === 'waiting_for_shipping_method' || outbound === 'waiting_for_shipping_details'
    return stage && !shipmentSent(order)
  })
  const shippingConfirm = scoped.filter((order) => {
    const outbound = order.linkedOutboundOrder?.status
    const stage = outbound === 'waiting_for_shipping_method' || outbound === 'waiting_for_shipping_details'
    return stage && shipmentSent(order)
  })
  const dispatch = scoped.filter(
    (order) =>
      order.status === 'ready_to_ship' ||
      order.linkedOutboundOrder?.status === 'ready_to_ship' ||
      order.linkedOutboundOrder?.status === 'packed',
  )
  const delivery = scoped.filter((order) => order.status === 'shipped' || order.status === 'out_for_delivery')
  const returns = scoped.filter((order) => order.status === 'failed_delivery')
  const cancellable = scoped.filter(
    (order) => isOmsAdminCancellableStatus(order.status) && order.status !== 'cancelled',
  )
  const printable = orders.filter((order) => labelReadiness(order) === 'ready')

  const progress = batch && batch.orderCount ? Math.round((batch.completedCount / batch.orderCount) * 100) : 0
  const stageText =
    batch?.stageKind === 'operational' && batch.stageKey
      ? omsOperationalStageLabel(batch.stageKey, isArabic)
      : batch?.stageKind === 'mixed'
        ? t('Mixed statuses', 'حالات متعددة')
        : batch?.stageKind === 'empty'
          ? t('Empty', 'بدون طلبات')
          : null

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: QK.omsBatch(id) }),
      qc.invalidateQueries({ queryKey: QK.omsBatches }),
      qc.invalidateQueries({ queryKey: QK.omsOrders }),
    ])
  }

  async function run(key: string, work: () => Promise<string | void>) {
    setBusy(key)
    try {
      const note = await work()
      toast.success(note || t('Action applied to eligible orders.', 'تم تنفيذ الإجراء على الطلبات المناسبة.'))
      setRowSelection({})
      await refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Action failed.', 'فشل الإجراء.'))
    } finally {
      setBusy(null)
    }
  }

  async function chunkedOms(ids: string[], call: (ids: string[]) => Promise<{ failed: number }>) {
    const parts = await runInChunks(ids, CHUNK, call)
    const failed = parts.reduce((sum, part) => sum + part.failed, 0)
    return failed
      ? t(`${failed} orders could not be updated.`, `بعض الطلبات لم تكتمل (${failed}).`)
      : undefined
  }

  async function outboundBulk(
    list: OmsOrderListItem[],
    call: (ids: string[]) => Promise<BulkIdsResponse>,
  ): Promise<string | undefined> {
    const outboundToOms = new Map<string, string>()
    for (const order of orders) {
      const ob = outboundId(order)
      if (ob) outboundToOms.set(ob, order.id)
    }
    const ids = list.map(outboundId).filter((value): value is string => Boolean(value))
    const parts = await runInChunks(ids, CHUNK, call)
    const failed = parts.reduce((sum, part) => sum + part.failed, 0)
    const failures = parts.flatMap((part) => part.failures ?? [])
    if (!failures.length) return failed ? t(`${failed} failed.`, `فشل ${failed}.`) : undefined

    const byNote = new Map<string, Set<string>>()
    for (const failure of failures) {
      const omsId = outboundToOms.get(failure.outboundOrderId)
      if (!omsId) continue
      const note = (failure.error || t('Action failed', 'فشل الإجراء')).slice(0, 200)
      const bucket = byNote.get(note) ?? new Set<string>()
      bucket.add(omsId)
      byNote.set(note, bucket)
    }
    let flagged = 0
    try {
      for (const [note, omsIds] of byNote) {
        await OmsApi.flagBatchOrders(id, [...omsIds], note)
        flagged += omsIds.size
      }
    } catch {
      /* best-effort */
    }
    return t(
      `${failed || failures.length} failed${flagged ? ` — ${flagged} flagged as issues` : ''}.`,
      `فشل ${failed || failures.length} طلب${flagged ? ` — تم تعليم ${flagged} كمشكلة` : ''}.`,
    )
  }

  const flagMut = useMutation({
    mutationFn: async () => {
      const note = issueNote.trim()
      if (!note) throw new Error(t('Issue note is required.', 'ملاحظة المشكلة مطلوبة.'))
      await OmsApi.flagBatchOrders(id, selectedIds, note)
    },
    onSuccess: () => {
      setIssueOpen(false)
      setIssueNote('')
      toast.success(t('Issue note saved without changing order status.', 'تم حفظ الملاحظة دون تغيير حالة الطلب.'))
      setRowSelection({})
      void refresh()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const actionHint = selectedIds.length
    ? t('Actions apply only to selected orders that are eligible.', 'الإجراءات ستُطبق على المحدد من بين الطلبات المناسبة فقط.')
    : t(
        'With nothing selected, the action includes every eligible order in this batch.',
        'بدون تحديد، الإجراء يشمل كل الطلبات المناسبة داخل المجموعة.',
      )

  const columns = useMemo<ColumnDef<OmsBatchOrderRow>[]>(
    () => [
      {
        id: 'order',
        header: t('Order', 'رقم الطلب'),
        cell: ({ row }) => <span className="font-semibold">{row.original.order.orderNumber}</span>,
        meta: { priority: 1, className: 'min-w-28' },
      },
      {
        id: 'recipient',
        header: t('Recipient', 'المستلم'),
        cell: ({ row }) => row.original.order.recipientName || '—',
        meta: { priority: 1, className: 'min-w-32' },
      },
      {
        id: 'status',
        header: t('Status', 'الحالة'),
        cell: ({ row }) => <OmsStatusBadge status={row.original.order.status} isArabic={isArabic} />,
        meta: { priority: 1, className: 'min-w-36' },
      },
      {
        id: 'stage',
        header: t('Stage', 'المرحلة'),
        cell: ({ row }) => <OmsStageBadge order={row.original.order} isArabic={isArabic} />,
        meta: { priority: 2, className: 'min-w-40' },
      },
      {
        id: 'issue',
        header: t('Issue', 'ملاحظة'),
        cell: ({ row }) => {
          if (row.original.issueNote) {
            return <span className="text-sm text-tone-danger-fg whitespace-pre-wrap">{row.original.issueNote}</span>
          }
          if (ISSUE_STATUSES.has(row.original.order.status)) {
            return <OmsStatusBadge status={row.original.order.status} isArabic={isArabic} />
          }
          return '—'
        },
        meta: { priority: 2, className: 'max-w-xs' },
      },
      {
        id: 'carrier',
        header: t('Carrier', 'الشحن'),
        cell: ({ row }) => (
          <OmsCarrierCell
            carrier={row.original.order.shippingCarrierName || row.original.order.carrier}
            shippingMethod={row.original.order.shippingMethod}
            isManualShipping={row.original.order.isManualShipping}
            outboundStatus={row.original.order.linkedOutboundOrder?.status}
            isArabic={isArabic}
          />
        ),
        meta: { priority: 2, className: 'min-w-36' },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const order = row.original.order
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={t('Actions', 'إجراءات')}>
                  <MoreHorizontal className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/orders/oms/${order.id}`)}>
                  {t('Open detail', 'فتح التفاصيل')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setWaybillOrderId(order.id)}>
                  <Receipt className="size-4" aria-hidden />
                  {t('Waybill', 'البوليصة')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setRowSelection({ [order.id]: true })
                    setIssueOpen(true)
                  }}
                >
                  <Flag className="size-4" aria-hidden />
                  {t('Flag issue', 'تعليم مشكلة')}
                </DropdownMenuItem>
                {row.original.issueNote ? (
                  <DropdownMenuItem
                    onClick={() =>
                      void run('clear-one', async () => {
                        await OmsApi.clearBatchFlags(id, [order.id])
                      })
                    }
                  >
                    {t('Clear flag', 'حل المشكلة')}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
        meta: { priority: 1, align: 'end', className: 'w-12' },
      },
    ],
    [isArabic, id, navigate, t],
  )

  if (!id) return null

  if (query.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <KpiStrip>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </KpiStrip>
      </div>
    )
  }

  if (query.isError || !batch) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="-ms-2 w-fit" asChild>
          <Link to="/oms/batches">
            <ArrowLeft className="rtl:rotate-180" aria-hidden />
            {t('Back to batches', 'العودة إلى المجموعات')}
          </Link>
        </Button>
        <ErrorState title={t('Could not load batch.', 'تعذر تحميل المجموعة.')} />
      </div>
    )
  }

  const title = batch.name ? `${batch.batchNumber} · ${batch.name}` : batch.batchNumber

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        description={t(
          'Orders stay in this batch even when their status changes.',
          'نفس الطلبات تبقى داخل هذه المجموعة حتى لو تغيرت حالتها.',
        )}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/oms/batches">
              <ArrowLeft className="rtl:rotate-180" aria-hidden />
              {t('Batches', 'المجموعات')}
            </Link>
          </Button>
        }
      />

      <KpiStrip cols={5}>
        <KpiCard title={t('Orders', 'الطلبات')} value={String(batch.orderCount)} />
        <KpiCard title={t('Completed', 'مكتمل')} value={String(batch.completedCount)} />
        <KpiCard title={t('Remaining', 'متبقي')} value={String(batch.pendingCount)} />
        <KpiCard title={t('Issues', 'مشكلات')} value={String(batch.issueCount)} />
        <KpiCard
          title={t('Progress', 'التقدم')}
          value={`${progress}%`}
          footer={
            stageText
              ? `${batch.completedCount}/${batch.orderCount} · ${stageText}`
              : `${batch.completedCount}/${batch.orderCount}`
          }
        />
      </KpiStrip>

      <div className="rounded-lg border bg-card px-4 py-3">
        <Progress value={progress} className="h-2" />
        {batch.stageKind === 'status' && batch.stageKey ? (
          <div className="mt-2">
            <OmsStatusBadge status={batch.stageKey} isArabic={isArabic} />
          </div>
        ) : null}
      </div>

      <KpiStrip cols={5}>
        <KpiCard title={t('Picked', 'تم الالتقاط')} value={String(batch.pickedCount ?? 0)} />
        <KpiCard title={t('Packed', 'تمت التعبئة')} value={String(batch.packedCount ?? 0)} />
        <KpiCard title={t('Ready', 'جاهز للشحن')} value={String(batch.readyToShipCount ?? 0)} />
        <KpiCard title={t('Shipped', 'تم الشحن')} value={String(batch.shippedCount ?? 0)} />
        <KpiCard title={t('Delivered', 'تم التسليم')} value={String(batch.deliveredCount ?? 0)} />
      </KpiStrip>

      <div className="rounded-lg border bg-muted/30 px-4 py-3">
        <p className="mb-3 text-sm text-muted-foreground">{actionHint}</p>
        <div className="flex flex-wrap gap-2">
          <BatchAction
            show={waitingConfirm.length > 0}
            busy={busy}
            label={t(`Confirm (${waitingConfirm.length})`, `تأكيد (${waitingConfirm.length})`)}
            onClick={() => void run('confirm', () => chunkedOms(waitingConfirm.map((o) => o.id), OmsApi.confirmBulk))}
          />
          <BatchAction
            show={waitingApproval.length > 0}
            busy={busy}
            label={t(`Approve (${waitingApproval.length})`, `موافقة (${waitingApproval.length})`)}
            onClick={() => void run('approve', () => chunkedOms(waitingApproval.map((o) => o.id), OmsApi.approveBulk))}
          />
          <BatchAction
            show={picking.length > 0}
            busy={busy}
            label={t(`Continue packing (${picking.length})`, `متابعة التعبئة (${picking.length})`)}
            onClick={() =>
              void run('picking', () => outboundBulk(picking, (chunk) => OutboundApi.bulkCompletePicking(chunk)))
            }
          />
          <BatchAction
            show={packing.length > 0}
            busy={busy}
            label={t(`Continue shipping (${packing.length})`, `متابعة الشحن (${packing.length})`)}
            onClick={() =>
              void run('packing', () => outboundBulk(packing, (chunk) => OutboundApi.bulkCompletePacking(chunk)))
            }
          />
          <BatchAction
            show={shippingDetails.length > 0}
            busy={busy}
            variant="outline"
            label={t(`Shipping details (${shippingDetails.length})`, `تفاصيل الشحن (${shippingDetails.length})`)}
            onClick={() => setShippingOpen(true)}
          />
          <BatchAction
            show={shippingConfirm.length > 0}
            busy={busy}
            label={t(`Confirm shipping (${shippingConfirm.length})`, `تأكيد الشحن (${shippingConfirm.length})`)}
            onClick={() =>
              void run('shipping-confirm', () =>
                outboundBulk(shippingConfirm, (chunk) => OutboundApi.bulkCompleteShippingDetails(chunk)),
              )
            }
          />
          <BatchAction
            show={dispatch.length > 0}
            busy={busy}
            label={t(`Out for delivery (${dispatch.length})`, `خروج للتسليم (${dispatch.length})`)}
            onClick={() =>
              void run('dispatch', () => outboundBulk(dispatch, (chunk) => OutboundApi.bulkCompleteDispatch(chunk)))
            }
          />
          <BatchAction
            show={delivery.length > 0}
            busy={busy}
            label={t(`Delivered (${delivery.length})`, `تم التسليم (${delivery.length})`)}
            onClick={() => void run('delivered', () => chunkedOms(delivery.map((o) => o.id), OmsApi.deliveredBulk))}
          />
          <BatchAction
            show={delivery.length > 0}
            busy={busy}
            variant="outline"
            label={t(`Failed (${delivery.length})`, `تعذر (${delivery.length})`)}
            onClick={() => void run('failed', () => chunkedOms(delivery.map((o) => o.id), OmsApi.failedDeliveryBulk))}
          />
          <BatchAction
            show={returns.length > 0}
            busy={busy}
            variant="outline"
            label={t(`Returned (${returns.length})`, `مرتجع (${returns.length})`)}
            onClick={() => void run('returned', () => chunkedOms(returns.map((o) => o.id), OmsApi.returnedBulk))}
          />
          <BatchAction
            show={cancellable.length > 0}
            busy={busy}
            variant="destructive"
            label={t(`Cancel (${cancellable.length})`, `إلغاء (${cancellable.length})`)}
            onClick={() => setBulkCancelOpen(true)}
          />
          <BatchAction
            show={batch.orderCount > 0}
            busy={busy}
            variant="outline"
            label={t('Picking PDF', 'قائمة الالتقاط')}
            onClick={() => void run('picking-pdf', async () => { await OmsApi.downloadBatchInstructionsPdf(id, 'picking') })}
          />
          <BatchAction
            show={batch.orderCount > 0}
            busy={busy}
            variant="outline"
            label={t('Packing PDF', 'قائمة التعبئة')}
            onClick={() => void run('packing-pdf', async () => { await OmsApi.downloadBatchInstructionsPdf(id, 'packing') })}
          />
          <BatchAction
            show={printable.length > 0}
            busy={busy}
            variant="outline"
            label={t(`Labels PDF (${printable.length})`, `بوالص (${printable.length})`)}
            onClick={() =>
              void run('labels', async () => {
                const basis = selectedIds.length ? scoped : printable
                const ready = basis.filter((order) => labelReadiness(order) === 'ready')
                const ordered = (ready.length ? ready : printable)
                  .slice()
                  .sort((a, b) => a.orderNumber.localeCompare(b.orderNumber, undefined, { numeric: true }))
                await OmsApi.downloadBatchLabels(id, ordered.map((o) => o.id), 'download')
              })
            }
          />
          {selectedIds.length > 0 ? (
            <>
              <Button type="button" variant="outline" size="sm" disabled={!!busy} onClick={() => setIssueOpen(true)}>
                <Flag className="size-4" aria-hidden />
                {t(`Flag (${selectedIds.length})`, `تعليم (${selectedIds.length})`)}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!!busy}
                onClick={() =>
                  void run('clear', async () => {
                    await OmsApi.clearBatchFlags(id, selectedIds)
                  })
                }
              >
                {t(`Clear flags (${selectedIds.length})`, `حل المشكلة (${selectedIds.length})`)}
              </Button>
              <Button type="button" variant="destructive" size="sm" disabled={!!busy} onClick={() => setRemoveOpen(true)}>
                <Trash2 className="size-4" aria-hidden />
                {t(`Remove (${selectedIds.length})`, `إزالة (${selectedIds.length})`)}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder={t('Search in batch', 'بحث داخل المجموعة')}
        className="max-w-md"
      />

      <DataTable
        columns={columns}
        data={filtered}
        getRowId={(row) => row.order.id}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        onRowClick={(row) => navigate(`/orders/oms/${row.order.id}`)}
        empty={t('No orders in this batch.', 'لا توجد طلبات في هذه المجموعة.')}
      />

      <OmsBulkShippingDetailsDialog
        open={shippingOpen}
        orders={shippingDetails}
        isArabic={isArabic}
        onClose={() => {
          setShippingOpen(false)
          void refresh()
        }}
        onSuccess={() => {
          setShippingOpen(false)
          void refresh()
        }}
      />

      <OmsWaybillDialog open={waybillOrderId !== null} orderId={waybillOrderId} onClose={() => setWaybillOrderId(null)} />

      <Dialog open={issueOpen} onOpenChange={(o) => !flagMut.isPending && setIssueOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Issue note', 'ملاحظة المشكلة')}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={issueNote}
            onChange={(e) => setIssueNote(e.target.value)}
            maxLength={200}
            rows={4}
            placeholder={t('Why these orders should stay aside', 'سبب إبقاء هذه الطلبات جانباً')}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIssueOpen(false)}>
              {t('Cancel', 'إلغاء')}
            </Button>
            <Button type="button" disabled={flagMut.isPending || !issueNote.trim()} onClick={() => flagMut.mutate()}>
              {flagMut.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {t('Save', 'حفظ')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={bulkCancelOpen}
        onOpenChange={(o) => !o && busy !== 'cancel' && setBulkCancelOpen(false)}
        intent="danger"
        title={t(`Cancel ${cancellable.length} order(s)?`, `إلغاء ${cancellable.length} طلب؟`)}
        description={t('Selected eligible orders will be marked cancelled.', 'سيتم إلغاء الطلبات المؤهلة المحددة.')}
        confirmLabel={t('Cancel orders', 'إلغاء الطلبات')}
        cancelLabel={t('Keep orders', 'تراجع')}
        loading={busy === 'cancel'}
        onConfirm={() => {
          setBulkCancelOpen(false)
          void run('cancel', () => chunkedOms(cancellable.map((o) => o.id), OmsApi.cancelBulk))
        }}
      />

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={(o) => !o && busy !== 'remove' && setRemoveOpen(false)}
        intent="danger"
        title={t(`Remove ${selectedIds.length} from batch?`, `إزالة ${selectedIds.length} من المجموعة؟`)}
        description={t('Order statuses will not change.', 'حالات الطلبات لن تتغير.')}
        confirmLabel={t('Remove', 'إزالة')}
        cancelLabel={t('Cancel', 'إلغاء')}
        loading={busy === 'remove'}
        onConfirm={() => {
          setRemoveOpen(false)
          void run('remove', async () => {
            await OmsApi.removeBatchOrders(id, selectedIds)
            return t('Orders removed from batch.', 'أُزيلت الطلبات من المجموعة.')
          })
        }}
      />
    </div>
  )
}

function BatchAction({
  show,
  label,
  busy,
  onClick,
  variant = 'default',
}: {
  show: boolean
  label: string
  busy: string | null
  onClick: () => void
  variant?: 'default' | 'outline' | 'destructive'
}) {
  if (!show) return null
  return (
    <Button type="button" size="sm" variant={variant} disabled={!!busy} onClick={onClick}>
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {label}
    </Button>
  )
}
