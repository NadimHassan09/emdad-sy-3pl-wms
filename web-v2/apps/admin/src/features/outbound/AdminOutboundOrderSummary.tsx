import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { formatDate, formatDateTime, useUiPreferences } from '@emdad/core'
import { ConfirmDialog, StatusBadge } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@emdad/ui/ui/card'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import type { OutboundOrder } from '@/api/outbound'
import { OutboundApi } from '@/api/outbound'
import { LocationsApi } from '@/api/locations'
import { OmsApi } from '@/api/oms'
import { ShippingApi } from '@/api/shipping'
import { WorkflowsApi } from '@/api/workflows'
import { QK } from '@/constants/query-keys'
import {
  isAdminExecutionMode,
  normalizeExecutionMode,
  outboundAdminPlanIsComplete,
} from '@/lib/execution-plan'
import { invalidateWorkflowTasksInventory } from '@/lib/invalidate-wms-queries'
import { OutboundOmsPanel } from './OutboundOmsPanel'
import { ShippingDetailsStageCard } from './ShippingDetailsStageCard'
import { ShippingMethodStageCard } from './ShippingMethodStageCard'
import { OutboundStatusBadge, outboundStatusHeadline } from './outbound-ui'

type Props = { order: OutboundOrder }

function fmtQty(s: string | number): string {
  const n = Number(s)
  if (Number.isFinite(n)) return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
  return String(s)
}

function Field({ label, value, className, preWrap }: { label: string; value?: ReactNode; className?: string; preWrap?: boolean }) {
  return (
    <div className={className}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm ${preWrap ? 'whitespace-pre-wrap' : ''}`}>{value ?? '—'}</div>
    </div>
  )
}

function useLocationLabels(ids: string[]) {
  const unique = useMemo(() => [...new Set(ids.filter(Boolean))], [ids])
  const queries = useQueries({
    queries: unique.map((id) => ({
      queryKey: QK.locations.byId(id),
      queryFn: () => LocationsApi.getById(id),
      staleTime: 60_000,
    })),
  })
  return useMemo(() => {
    const map = new Map<string, string>()
    unique.forEach((id, i) => {
      const loc = queries[i]?.data
      map.set(id, loc?.fullPath?.trim() || id)
    })
    return map
  }, [unique, queries])
}

function taskHref(taskId: string, companyId: string): string {
  return `/tasks/${taskId}?companyId=${encodeURIComponent(companyId)}`
}

export function AdminOutboundOrderSummary({ order }: Props) {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const qc = useQueryClient()
  const mode = normalizeExecutionMode(order.executionMode)
  const isAdminMode = isAdminExecutionMode(order.executionMode)
  const isPlannable = order.status === 'draft' || order.status === 'pending_approval' || order.status === 'allocated'
  const plan = order.executionPlan
  const requiresPacking = order.requiresPacking !== false
  const lines = order.lines ?? []

  const planReady = useMemo(() => outboundAdminPlanIsComplete(plan, lines), [lines, plan])
  const locationLabels = useLocationLabels([
    plan?.packingLocationId ?? '',
    plan?.dispatchDockId ?? '',
  ])

  const omsOrderId = order.omsOrder?.id
  const omsQuery = useQuery({
    queryKey: [...QK.omsOrders, omsOrderId],
    queryFn: () => OmsApi.getOrder(omsOrderId!),
    enabled: Boolean(omsOrderId),
  })

  const pickAllocations = useMemo(() => {
    const productById = new Map(lines.map((l) => [l.productId, l.product] as const))
    return (order.stockReservations ?? []).map((r) => ({
      id: r.id,
      productName: r.product?.name ?? productById.get(r.productId)?.name ?? '—',
      productSku: r.product?.sku ?? productById.get(r.productId)?.sku ?? '—',
      location: r.location?.fullPath?.trim() || r.locationId,
      lotNumber: r.lot?.lotNumber?.trim() || '—',
      quantity: r.quantity,
    }))
  }, [lines, order.stockReservations])

  const timeline = useQuery({
    queryKey: QK.workflows.timeline('outbound_order', order.id),
    queryFn: () => WorkflowsApi.getTimeline('outbound_order', order.id, order.companyId),
    enabled: !isPlannable,
  })

  type AdminStageAction = 'approve' | 'complete_picking' | 'complete_packing' | 'complete_dispatch' | 'release'

  const adminStageAction: AdminStageAction | null = useMemo(() => {
    if (!isAdminMode) return isPlannable ? 'release' : null
    if (isPlannable) return 'approve'
    if (order.status === 'picking') return 'complete_picking'
    if (order.status === 'packing') return 'complete_packing'
    if (order.status === 'ready_to_ship') return 'complete_dispatch'
    return null
  }, [isAdminMode, isPlannable, order.status])

  const stageMut = useMutation({
    mutationFn: async () => {
      if (adminStageAction === 'release') {
        if (!planReady || !plan) throw new Error(t('Complete the warehouse plan first.', 'أكمل خطة المستودع أولاً.'))
        return OutboundApi.confirm(order.id, { warehouseId: plan.warehouseId }, order.companyId)
      }
      if (adminStageAction === 'approve') {
        if (!planReady || !plan) throw new Error(t('Complete the warehouse plan first.', 'أكمل خطة المستودع أولاً.'))
        return OutboundApi.approve(order.id, order.companyId)
      }
      if (adminStageAction === 'complete_picking') return OutboundApi.completePicking(order.id, order.companyId)
      if (adminStageAction === 'complete_packing') return OutboundApi.completePacking(order.id, order.companyId)
      if (adminStageAction === 'complete_dispatch') return OutboundApi.completeDispatch(order.id, order.companyId)
      throw new Error('No stage action')
    },
    onSuccess: (updated) => {
      toast.success(t('Stage updated.', 'تم تحديث المرحلة.'))
      if (updated?.id) qc.setQueryData([...QK.outboundOrders, updated.id], updated)
      void qc.invalidateQueries({ queryKey: [...QK.outboundOrders, order.id] })
      void qc.invalidateQueries({ queryKey: QK.outboundOrders })
      invalidateWorkflowTasksInventory(qc, { referenceId: order.id, referenceType: 'outbound_order' })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const latestCarrierShipment = order.carrierShipments?.[0] ?? null
  const carrierMethod = order.shippingMethod === 'carrier'
  const canRetryCarrier =
    carrierMethod &&
    latestCarrierShipment?.status === 'failed' &&
    ['waiting_for_shipping_details', 'ready_to_ship', 'shipped'].includes(order.status)

  const retryShipmentMut = useMutation({
    mutationFn: () => ShippingApi.retryShipment(order.id),
    onSuccess: () => {
      toast.success(t('Retry started.', 'بدأت إعادة المحاولة.'))
      void qc.invalidateQueries({ queryKey: [...QK.outboundOrders, order.id] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const stageCtaLabel =
    adminStageAction === 'approve'
      ? t('Approve', 'اعتماد')
      : adminStageAction === 'complete_picking'
        ? t('Mark picking complete', 'إكمال الالتقاط')
        : adminStageAction === 'complete_packing'
          ? t('Mark packing complete', 'إكمال التعبئة')
          : adminStageAction === 'complete_dispatch'
            ? t('Mark dispatch complete', 'إكمال الإرسال')
            : adminStageAction === 'release'
              ? t('Release to workers', 'إطلاق للعمال')
              : null

  const [dispatchConfirmOpen, setDispatchConfirmOpen] = useState(false)
  const headline = outboundStatusHeadline(order.status, isArabic)
  const openTasks = (timeline.data?.tasks ?? []).filter(
    (tk) => tk.status === 'pending' || tk.status === 'assigned' || tk.status === 'in_progress',
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-2xl font-semibold">{order.orderNumber || order.id}</h1>
            {headline ? (
              <StatusBadge tone="warning">{headline}</StatusBadge>
            ) : (
              <OutboundStatusBadge status={order.status} isArabic={isArabic} />
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdminMode
              ? t('Complete each warehouse stage explicitly.', 'أكمل كل مرحلة مستودع صراحة.')
              : t('Release work to warehouse workers.', 'أطلِق العمل لعمال المستودع.')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isPlannable ? (
            <Button variant="outline" asChild>
              <Link to={`/orders/outbound/${order.id}/edit`}>{planReady ? t('Edit plan', 'تعديل الخطة') : t('Complete plan', 'إكمال الخطة')}</Link>
            </Button>
          ) : null}
          {stageCtaLabel ? (
            <Button
              type="button"
              disabled={(adminStageAction === 'approve' || adminStageAction === 'release') && !planReady}
              onClick={() => {
                if (adminStageAction === 'complete_dispatch') setDispatchConfirmOpen(true)
                else stageMut.mutate()
              }}
            >
              {stageCtaLabel}
            </Button>
          ) : null}
        </div>
      </div>

      {isPlannable && !planReady ? (
        <Alert>
          <AlertTitle>{t('Warehouse plan incomplete', 'خطة المستودع غير مكتملة')}</AlertTitle>
          <AlertDescription>{t('Open Complete plan, then approve or release.', 'افتح إكمال الخطة، ثم اعتمد أو أطلِق.')}</AlertDescription>
        </Alert>
      ) : null}

      {omsOrderId && omsQuery.data ? (
        <OutboundOmsPanel
          omsOrderId={omsOrderId}
          order={omsQuery.data}
          isArabic={isArabic}
          onRefresh={() => {
            void omsQuery.refetch()
            void qc.invalidateQueries({ queryKey: [...QK.outboundOrders, order.id] })
          }}
        />
      ) : omsOrderId && omsQuery.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('Order details', 'تفاصيل الطلب')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Field label={t('Client', 'العميل')} value={order.company?.name ?? '—'} />
            <Field label={t('Execution', 'التنفيذ')} value={mode === 'admin' ? t('Admin', 'مسؤول') : t('Workers', 'عمال')} />
            <Field label={t('Required ship', 'الشحن المطلوب')} value={formatDate(order.requiredShipDate, locale)} />
            <Field label={t('Created', 'تاريخ الإنشاء')} value={formatDateTime(order.createdAt, locale)} />
            <Field label={t('Packing', 'التغليف')} value={requiresPacking ? t('Required', 'مطلوب') : t('Skipped', 'متخطى')} />
            {order.omsOrder ? (
              <Field
                label={t('Linked OMS', 'OMS مرتبط')}
                value={
                  <Link to={`/orders/oms/${order.omsOrder.id}`} className="font-medium text-primary hover:underline">
                    {order.omsOrder.orderNumber}
                  </Link>
                }
              />
            ) : null}
            <Field label={t('Destination', 'الوجهة')} value={order.destinationAddress?.trim() || '—'} className="sm:col-span-2" preWrap />
            <Field label={t('Notes', 'ملاحظات')} value={order.notes?.trim() || '—'} className="sm:col-span-2" preWrap />
          </dl>
        </CardContent>
      </Card>

      {(order.status as string) === 'waiting_for_shipping_method' ? <ShippingMethodStageCard order={order} isArabic={isArabic} /> : null}
      {order.status === 'waiting_for_shipping_details' ? <ShippingDetailsStageCard order={order} isArabic={isArabic} /> : null}

      {carrierMethod && order.status !== 'waiting_for_shipping_details' ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('Carrier shipment', 'شحنة الشركة')}</CardTitle>
            {canRetryCarrier ? (
              <Button type="button" variant="outline" size="sm" disabled={retryShipmentMut.isPending} onClick={() => retryShipmentMut.mutate()}>
                {t('Retry', 'إعادة المحاولة')}
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field label={t('Status', 'الحالة')} value={latestCarrierShipment?.status ?? '—'} />
              <Field label={t('AWB', 'البوليصة')} value={latestCarrierShipment?.externalAwb?.trim() || order.trackingNumber?.trim() || '—'} />
            </dl>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('Line items', 'البنود')}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-start">#</th>
                <th className="px-2 py-2 text-start">{t('Product', 'المنتج')}</th>
                <th className="px-2 py-2 text-start">SKU</th>
                <th className="px-2 py-2 text-end">{t('Requested', 'المطلوب')}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-t">
                  <td className="px-2 py-2">{line.lineNumber}</td>
                  <td className="px-2 py-2 font-medium">{line.product?.name ?? '—'}</td>
                  <td className="px-2 py-2 font-mono text-xs">{line.product?.sku ?? '—'}</td>
                  <td className="px-2 py-2 text-end font-semibold tabular">{fmtQty(line.requestedQuantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('Pick allocation', 'تخصيص الالتقاط')}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {pickAllocations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('No allocation yet.', 'لا تخصيص بعد.')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-start">{t('Product', 'المنتج')}</th>
                  <th className="px-2 py-2 text-start">{t('Location', 'الموقع')}</th>
                  <th className="px-2 py-2 text-start">{t('Lot', 'الدفعة')}</th>
                  <th className="px-2 py-2 text-end">{t('Qty', 'الكمية')}</th>
                </tr>
              </thead>
              <tbody>
                {pickAllocations.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-2 py-2">
                      <div className="font-medium">{row.productName}</div>
                      <div className="font-mono text-xs text-muted-foreground">{row.productSku}</div>
                    </td>
                    <td className="px-2 py-2">{row.location}</td>
                    <td className="px-2 py-2 font-mono text-xs">{row.lotNumber}</td>
                    <td className="px-2 py-2 text-end tabular">{fmtQty(row.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('Warehouse plan', 'خطة المستودع')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Field
              label={t('Packing location', 'موقع التغليف')}
              value={plan?.packingLocationId ? locationLabels.get(plan.packingLocationId) : '—'}
            />
            <Field
              label={t('Dispatch dock', 'رصيف الإرسال')}
              value={plan?.dispatchDockId ? locationLabels.get(plan.dispatchDockId) : '—'}
            />
          </dl>
        </CardContent>
      </Card>

      {!isPlannable && openTasks.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('Open warehouse tasks', 'مهام مستودع مفتوحة')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {openTasks.map((tk) => (
                <li key={tk.id}>
                  <Link to={taskHref(tk.id, order.companyId)} className="font-medium text-primary hover:underline">
                    {tk.taskType} · {tk.status}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        open={dispatchConfirmOpen}
        onOpenChange={(o) => !stageMut.isPending && setDispatchConfirmOpen(o)}
        title={t('Mark dispatch complete?', 'إكمال الإرسال؟')}
        description={t('Updates linked OMS to shipped when applicable.', 'يحدّث OMS المرتب إلى «تم الشحن» عند الانطباق.')}
        confirmLabel={t('Mark dispatch complete', 'إكمال الإرسال')}
        cancelLabel={t('Cancel', 'إلغاء')}
        loading={stageMut.isPending}
        onConfirm={() => stageMut.mutate(undefined, { onSettled: () => setDispatchConfirmOpen(false) })}
      />
    </div>
  )
}
