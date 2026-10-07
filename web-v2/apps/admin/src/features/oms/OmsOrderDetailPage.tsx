import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useParams } from 'react-router'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Loader2,
  Pencil,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { ConfirmDialog, ErrorState, PageHeader, useNavigate } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@emdad/ui/ui/card'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@emdad/ui/ui/dialog'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { Textarea } from '@emdad/ui/ui/textarea'
import { CodApi, OmsApi, OmsReturnsApi } from '@/api/oms'
import { QK } from '@/constants/query-keys'
import {
  mapOmsCommercialDisplayStatus,
  omsCommercialStatusLabel,
} from '@/lib/oms-commercial-status'
import { isOmsAdminCancellableStatus } from '@/lib/oms-order-cancel'
import { isOmsOrderDeletable } from '@/lib/oms-order-delete'
import { isOmsReturnEligibleStatus } from '@/lib/oms-return-eligibility'
import { OmsOrderFormDialog } from './OmsOrderFormDialog'
import { OmsOrderTrackingPanel } from './OmsOrderTrackingPanel'
import { OmsShipmentMovementPanel } from './OmsShipmentMovementPanel'
import { OmsShippingFeeDialog } from './OmsShippingFeeDialog'
import { OmsStatusBadge } from './oms-ui'
import { OmsWaybillDialog } from './OmsWaybillDialog'
import { CreateOmsReturnDialog } from './CreateOmsReturnDialog'

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  )
}

function fmtMoney(value: string | null | undefined, currency?: string | null): string {
  if (!value) return '—'
  return `${value}${currency ? ` ${currency}` : ''}`
}

export function OmsOrderDetailPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const [editOpen, setEditOpen] = useState(false)
  const [createReturnOpen, setCreateReturnOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [undoCancelOpen, setUndoCancelOpen] = useState(false)
  const [shippingFeeOpen, setShippingFeeOpen] = useState(false)
  const [revertOpen, setRevertOpen] = useState(false)
  const [waybillOpen, setWaybillOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [revertReason, setRevertReason] = useState('')

  const openShippingFeeRequested = Boolean((location.state as { openShippingFee?: boolean } | null)?.openShippingFee)
  const autoOpenedShippingFeeModalRef = useRef(false)

  const orderQuery = useQuery({
    queryKey: [...QK.omsOrders, id],
    queryFn: () => OmsApi.getOrder(id),
    enabled: !!id,
  })

  const codQuery = useQuery({
    queryKey: ['cod-by-order', id],
    queryFn: () => CodApi.byOrder(id),
    enabled: !!id,
  })

  const returnsQuery = useQuery({
    queryKey: ['oms-returns', 'by-order', id],
    queryFn: () => OmsReturnsApi.list({ omsOrderId: id, limit: 20 }),
    enabled: !!id,
  })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: [...QK.omsOrders, id] })
    void qc.invalidateQueries({ queryKey: QK.omsOrders })
    void qc.invalidateQueries({ queryKey: QK.omsDashboard })
    void qc.invalidateQueries({ queryKey: ['cod-by-order', id] })
    void qc.invalidateQueries({ queryKey: ['oms-returns', 'by-order', id] })
  }

  const deleteMut = useMutation({
    mutationFn: () => OmsApi.delete(id),
    onSuccess: () => {
      toast.success(t('OMS order deleted.', 'تم حذف طلب OMS.'))
      void qc.invalidateQueries({ queryKey: QK.omsOrders })
      navigate('/orders/oms')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const approveMut = useMutation({
    mutationFn: () => OmsApi.approve(id),
    onSuccess: () => {
      toast.success(t('Order approved.', 'تم اعتماد الطلب.'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const setShippingFeeMut = useMutation({
    mutationFn: (fee: number) => OmsApi.update(id, { shippingFee: fee }),
    onSuccess: () => {
      toast.success(t('Shipping fee updated.', 'تم تحديث رسوم الشحن.'))
      setShippingFeeOpen(false)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rejectMut = useMutation({
    mutationFn: () => OmsApi.reject(id, rejectReason.trim() || undefined),
    onSuccess: () => {
      toast.success(t('Order rejected.', 'تم رفض الطلب.'))
      setRejectOpen(false)
      setRejectReason('')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const cancelMut = useMutation({
    mutationFn: () => OmsApi.cancel(id),
    onSuccess: () => {
      toast.success(t('Order cancelled.', 'تم إلغاء الطلب.'))
      setCancelOpen(false)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const undoCancelMut = useMutation({
    mutationFn: () => OmsApi.revertCancel(id),
    onSuccess: () => {
      toast.success(t('Cancellation undone.', 'تم التراجع عن الإلغاء.'))
      setUndoCancelOpen(false)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deliveredMut = useMutation({
    mutationFn: () => OmsApi.delivered(id),
    onSuccess: () => {
      toast.success(t('Order marked delivered.', 'تم تسجيل التسليم.'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const failedDeliveryMut = useMutation({
    mutationFn: () => OmsApi.failedDelivery(id),
    onSuccess: () => {
      toast.success(t('Order marked as failed delivery.', 'تم تسجيل تعذر التسليم.'))
      invalidate()
      void qc.invalidateQueries({ queryKey: ['oms-returns'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const returnedMut = useMutation({
    mutationFn: () => OmsApi.returned(id),
    onSuccess: () => {
      toast.success(
        t('Return request created (awaiting confirmation in Returns).', 'تم إنشاء طلب الإرجاع (بانتظار التأكيد في المرتجعات).'),
      )
      invalidate()
      void qc.invalidateQueries({ queryKey: ['oms-returns'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const confirmMut = useMutation({
    mutationFn: () => OmsApi.confirm(id),
    onSuccess: () => {
      toast.success(t('Order confirmed (waiting for admin approval).', 'تم تأكيد الطلب (بانتظار موافقة الإدارة).'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const revertDeliveryMut = useMutation({
    mutationFn: () => OmsApi.revertDelivery(id, revertReason.trim()),
    onSuccess: () => {
      toast.success(t('Delivery reverted to shipped.', 'تم التراجع عن التسليم إلى «خرج للتسليم».'))
      setRevertOpen(false)
      setRevertReason('')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const retryCodMut = useMutation({
    mutationFn: () => CodApi.retryGeneration(id),
    onSuccess: () => {
      toast.success(t('COD generation retried.', 'أُعيدت محاولة إنشاء COD.'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const order = orderQuery.data
  const commercial = order ? mapOmsCommercialDisplayStatus(order.status) : null

  useEffect(() => {
    if (!openShippingFeeRequested) return
    if (autoOpenedShippingFeeModalRef.current) return
    if (!order) return
    if (order.status !== 'delivered' && order.status !== 'completed') return
    setShippingFeeOpen(true)
    autoOpenedShippingFeeModalRef.current = true
  }, [openShippingFeeRequested, order])

  if (orderQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (orderQuery.isError || !order) {
    return (
      <div className="space-y-4">
        <Link to="/orders/oms" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {t('Back to OMS orders', 'العودة إلى طلبات OMS')}
        </Link>
        <ErrorState title={t('Could not load OMS order.', 'تعذر تحميل طلب OMS.')} onRetry={() => orderQuery.refetch()} />
      </div>
    )
  }

  const total = order.total ?? order.subtotal ?? null
  const outboundId = order.linkedOutboundOrder?.id ?? order.outboundOrderId
  const canConfirm = commercial === 'waiting_for_confirmation'
  const canApprove = commercial === 'confirmed_waiting_for_admin_approval' && !order.needsInformation
  const canReject =
    commercial === 'confirmed_waiting_for_admin_approval' || commercial === 'waiting_for_confirmation'
  const canEditCommercial =
    commercial === 'waiting_for_confirmation' ||
    commercial === 'confirmed_waiting_for_admin_approval' ||
    commercial === 'processing'
  const canMarkDelivered = commercial === 'shipped'
  const canMarkFailedDelivery = commercial === 'shipped' || order.status === 'out_for_delivery'
  const canMarkReturned = order.status === 'failed_delivery'
  const canRevertDelivery = commercial === 'delivered'
  const canUndoCancel = Boolean(order.canRevertCancel)
  const canCancel = isOmsAdminCancellableStatus(order.status)
  const canCreateReturn = isOmsReturnEligibleStatus(order.status)
  const canDelete = isOmsOrderDeletable(order.status)
  const canSpecifyShippingFeeAfterDelivery =
    commercial === 'delivered' || order.status === 'delivered' || order.status === 'completed'
  const canRetryCod = order.codGenerationStatus === 'failed'

  const handleCreateReturn = () => setCreateReturnOpen(true)

  return (
    <div className="space-y-5">
      <Link to="/orders/oms" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t('Back to OMS orders', 'العودة إلى طلبات OMS')}
      </Link>

      <PageHeader
        title={order.orderNumber}
        description={order.company?.name ?? undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            {order.status !== 'cancelled' ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setWaybillOpen(true)}>
                  <FileText className="size-4" aria-hidden />
                  {t('Waybill', 'بوليصة الشحن')}
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <a href={`/orders/oms/${order.id}/waybill`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4" aria-hidden />
                    {t('Full page', 'صفحة كاملة')}
                  </a>
                </Button>
              </>
            ) : null}
            {canConfirm ? (
              <Button size="sm" disabled={confirmMut.isPending} onClick={() => confirmMut.mutate()}>
                {confirmMut.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {t('Confirm order', 'تأكيد الطلب')}
              </Button>
            ) : null}
            {canApprove ? (
              <Button size="sm" disabled={approveMut.isPending} onClick={() => approveMut.mutate()}>
                {approveMut.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {t('Approve', 'اعتماد')}
              </Button>
            ) : null}
            {canReject ? (
              <Button variant="outline" size="sm" onClick={() => setRejectOpen(true)}>
                {t('Reject', 'رفض')}
              </Button>
            ) : null}
            {canMarkDelivered ? (
              <Button size="sm" disabled={deliveredMut.isPending} onClick={() => deliveredMut.mutate()}>
                {t('Mark delivered', 'تسجيل التسليم')}
              </Button>
            ) : null}
            {canMarkFailedDelivery ? (
              <Button variant="outline" size="sm" disabled={failedDeliveryMut.isPending} onClick={() => failedDeliveryMut.mutate()}>
                {t('Mark failed delivery', 'تعذر التسليم')}
              </Button>
            ) : null}
            {canMarkReturned ? (
              <Button variant="outline" size="sm" disabled={returnedMut.isPending} onClick={() => returnedMut.mutate()}>
                {t('Mark as return', 'تسجيل كمرتجع')}
              </Button>
            ) : null}
            {canRevertDelivery ? (
              <Button variant="outline" size="sm" onClick={() => setRevertOpen(true)}>
                <RotateCcw className="size-4" aria-hidden />
                {t('Revert delivery', 'التراجع عن التسليم')}
              </Button>
            ) : null}
            {canCancel ? (
              <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)}>
                {t('Cancel order', 'إلغاء الطلب')}
              </Button>
            ) : null}
            {canUndoCancel ? (
              <Button variant="outline" size="sm" onClick={() => setUndoCancelOpen(true)}>
                {t('Undo cancel', 'تراجع عن الإلغاء')}
              </Button>
            ) : null}
            {canSpecifyShippingFeeAfterDelivery ? (
              <Button variant="outline" size="sm" onClick={() => setShippingFeeOpen(true)}>
                {t('Specify shipping fee', 'تحديد رسوم الشحن')}
              </Button>
            ) : null}
            {canRetryCod ? (
              <Button variant="outline" size="sm" disabled={retryCodMut.isPending} onClick={() => retryCodMut.mutate()}>
                {t('Retry COD', 'إعادة COD')}
              </Button>
            ) : null}
            {canCreateReturn ? (
              <Button variant="outline" size="sm" onClick={handleCreateReturn}>
                {t('Create return', 'إنشاء مرتجع')}
              </Button>
            ) : null}
            {outboundId ? (
              <Button variant="outline" size="sm" onClick={() => navigate(`/orders/outbound/${outboundId}`)}>
                {t('Open outbound', 'فتح أمر الصادر')}
              </Button>
            ) : null}
            {canEditCommercial ? (
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" aria-hidden />
                {t('Edit', 'تعديل')}
              </Button>
            ) : null}
            {canDelete ? (
              <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="size-4" aria-hidden />
                {t('Delete', 'حذف')}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <OmsStatusBadge status={order.status} isArabic={isArabic} needsInformation={order.needsInformation} />
        {order.rejectionReason ? (
          <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
            {t('Rejected', 'مرفوض')}: {order.rejectionReason}
          </span>
        ) : null}
      </div>

      {order.needsInformation ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="alert">
          <p className="font-semibold">{t('Incomplete order', 'طلب غير مكتمل')}</p>
          <p className="mt-1">
            {t(
              'Shipping information is incomplete. Use Edit to complete governorate, city/region, and town/neighborhood before approval.',
              'معلومات الشحن غير مكتملة. استخدم التعديل لإكمال المحافظة والمدينة/المنطقة والحي قبل الاعتماد.',
            )}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t('Recipient & shipping', 'المستلم والشحن')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <Field label={t('Recipient', 'المستلم')} value={order.recipientName ?? '—'} />
                <Field label={t('Phone', 'الهاتف')} value={order.recipientPhone ?? '—'} />
                <Field label={t('Governorate', 'المحافظة')} value={order.city ?? '—'} />
                <Field label={t('City / region', 'المدينة / المنطقة')} value={order.district ?? '—'} />
                <Field label={t('Town / neighborhood', 'الحي / البلدة')} value={order.addressLine1 ?? '—'} />
                <Field
                  label={t('Detailed address', 'العنوان التفصيلي')}
                  value={order.addressLine2 || order.destinationAddress || '—'}
                />
                <Field label={t('Carrier', 'شركة الشحن')} value={order.carrier ?? '—'} />
                <Field label={t('Tracking', 'التتبع')} value={order.trackingNumber ?? '—'} />
                {order.deliveryInstructions ? (
                  <div className="sm:col-span-2">
                    <Field label={t('Instructions', 'تعليمات')} value={order.deliveryInstructions} />
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">{t('Line items', 'بنود الطلب')}</CardTitle>
              <span className="text-sm text-muted-foreground">
                {order.lines.length} {order.lines.length === 1 ? t('item', 'بند') : t('items', 'بنود')}
              </span>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-start">#</th>
                    <th className="px-4 py-2.5 text-start">SKU</th>
                    <th className="px-4 py-2.5 text-start">{t('Product', 'المنتج')}</th>
                    <th className="px-4 py-2.5 text-end">{t('Qty', 'الكمية')}</th>
                    <th className="px-4 py-2.5 text-end">{t('Price', 'السعر')}</th>
                    <th className="px-4 py-2.5 text-end">{t('Line total', 'إجمالي السطر')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {order.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-2.5 text-muted-foreground">{line.lineNumber}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{line.product?.sku ?? '—'}</td>
                      <td className="px-4 py-2.5 font-medium">{line.product?.name ?? line.productId}</td>
                      <td className="px-4 py-2.5 text-end tabular-nums">{line.requestedQuantity}</td>
                      <td className="px-4 py-2.5 text-end tabular-nums">{line.unitPrice ?? '—'}</td>
                      <td className="px-4 py-2.5 text-end font-semibold tabular-nums">{line.lineTotal ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {order.notes ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t('Notes', 'ملاحظات')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{order.notes}</p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t('Returns', 'المرتجعات')}</CardTitle>
            </CardHeader>
            <CardContent>
              {(returnsQuery.data?.items ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {canCreateReturn
                    ? t('No returns yet. Use Create return to open a return request.', 'لا مرتجعات بعد. استخدم «إنشاء مرتجع».')
                    : t('No returns for this order.', 'لا مرتجعات لهذا الطلب.')}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b text-start text-xs uppercase text-muted-foreground">
                        <th className="px-2 py-2">{t('Return #', 'رقم المرتجع')}</th>
                        <th className="px-2 py-2">{t('Status', 'الحالة')}</th>
                        <th className="px-2 py-2">{t('Reason', 'السبب')}</th>
                        <th className="px-2 py-2">{t('Created', 'تاريخ الإنشاء')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(returnsQuery.data?.items ?? []).map((ret) => (
                        <tr key={ret.id} className="border-b">
                          <td className="px-2 py-2">
                            <Link to={`/oms/returns/${ret.id}`} className="font-medium text-primary hover:underline">
                              {ret.returnNumber}
                            </Link>
                          </td>
                          <td className="px-2 py-2">{ret.status.replace(/_/g, ' ')}</td>
                          <td className="px-2 py-2">{ret.reason ?? '—'}</td>
                          <td className="px-2 py-2">{new Date(ret.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t('Order details', 'تفاصيل الطلب')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label={t('Order #', 'رقم الطلب')} value={order.orderNumber} />
              <Field label={t('Client', 'العميل')} value={order.company?.name ?? '—'} />
              <Field label={t('Client reference', 'مرجع العميل')} value={order.clientReference ?? '—'} />
              <Field
                label={t('Required ship', 'تاريخ الشحن المطلوب')}
                value={new Date(order.requiredShipDate).toLocaleDateString()}
              />
              <Field
                label={t('Submitted', 'تاريخ الإرسال')}
                value={order.submittedAt ? new Date(order.submittedAt).toLocaleString() : '—'}
              />
              <Field label={t('Created', 'تاريخ الإنشاء')} value={new Date(order.createdAt).toLocaleString()} />
              {order.warehouseStatus ? (
                <Field label={t('Warehouse status', 'حالة المستودع')} value={order.warehouseStatus} />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t('Pricing & COD', 'التسعير و COD')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label={t('Payment', 'الدفع')} value={order.paymentMethod ?? '—'} />
              <Field label={t('Shipping fee', 'رسوم الشحن')} value={fmtMoney(order.shippingFee, order.currency)} />
              <Field
                label={t('Subtotal', 'المجموع')}
                value={<span className="font-semibold">{fmtMoney(order.subtotal ?? total, order.currency)}</span>}
              />
              <Field label={t('COD amount', 'مبلغ COD')} value={fmtMoney(order.codAmount, order.currency)} />
              <Field label={t('Legacy COD status', 'حالة COD (قديم)')} value={order.codStatus ?? '—'} />
              {codQuery.data ? (
                <div className="mt-4 rounded-lg border bg-muted/30 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('COD record', 'سجل COD')}
                    </h3>
                    <Link to={`/oms/cod/${codQuery.data.id}`} className="text-xs font-medium text-primary hover:underline">
                      {t('View details', 'عرض التفاصيل')}
                    </Link>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t('Status', 'الحالة')} value={codQuery.data.status.replace(/_/g, ' ')} />
                    <Field
                      label={t('Original amount', 'المبلغ الأصلي')}
                      value={fmtMoney(codQuery.data.originalAmount, codQuery.data.currency)}
                    />
                    <Field
                      label={t('Current amount', 'المبلغ الحالي')}
                      value={fmtMoney(codQuery.data.currentAmount, codQuery.data.currency)}
                    />
                    <Field
                      label={t('Available at', 'متاح في')}
                      value={
                        codQuery.data.availableAt ? new Date(codQuery.data.availableAt).toLocaleString() : '—'
                      }
                    />
                  </div>
                </div>
              ) : codQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">{t('Loading COD record…', 'جاري تحميل سجل COD…')}</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <OmsOrderTrackingPanel order={order} isArabic={isArabic} />
      <OmsShipmentMovementPanel order={order} isArabic={isArabic} />

      <OmsOrderFormDialog
        open={editOpen}
        orderId={id}
        onOpenChange={setEditOpen}
        onSaved={() => invalidate()}
        isArabic={isArabic}
      />

      <OmsWaybillDialog open={waybillOpen} orderId={id} onClose={() => setWaybillOpen(false)} />

      <OmsShippingFeeDialog
        open={shippingFeeOpen}
        onOpenChange={setShippingFeeOpen}
        initialFee={order.shippingFee}
        loading={setShippingFeeMut.isPending}
        onSave={(fee) => setShippingFeeMut.mutate(fee)}
        isArabic={isArabic}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('Delete this OMS order?', 'حذف طلب OMS؟')}
        confirmLabel={t('Delete', 'حذف')}
        cancelLabel={t('Cancel', 'إلغاء')}
        intent="danger"
        loading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate()}
      >
        <p className="text-sm">
          {t(
            'This removes only the OMS commercial record. It does not cancel or delete any linked warehouse outbound.',
            'يحذف سجل OMS التجاري فقط ولا يلغي أو يحذف أمر الصادر المرتبط.',
          )}
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={t('Cancel this OMS order?', 'إلغاء طلب OMS؟')}
        confirmLabel={t('Cancel order', 'إلغاء الطلب')}
        cancelLabel={t('Keep order', 'الإبقاء على الطلب')}
        intent="danger"
        loading={cancelMut.isPending}
        onConfirm={() => cancelMut.mutate()}
      >
        <p className="text-sm">{t('The order will be marked cancelled in the commercial lifecycle.', 'سيُعلَّم الطلب كملغي في دورة OMS.')}</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={undoCancelOpen}
        onOpenChange={setUndoCancelOpen}
        title={t('Undo this cancellation?', 'التراجع عن الإلغاء؟')}
        confirmLabel={t('Undo cancel', 'تراجع عن الإلغاء')}
        cancelLabel={t('Keep cancelled', 'الإبقاء ملغياً')}
        loading={undoCancelMut.isPending}
        onConfirm={() => undoCancelMut.mutate()}
      >
        <p className="text-sm">
          {t('The order will return to', 'سيعود الطلب إلى')}{' '}
          <strong>
            {omsCommercialStatusLabel(order.revertCancelToStatus ?? order.cancelledFromStatus ?? '', isArabic)}
          </strong>
          .
        </p>
      </ConfirmDialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('Reject OMS order', 'رفض طلب OMS')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason" className="text-sm">
              {t('Reason (optional)', 'السبب (اختياري)')}
            </Label>
            <Input id="reject-reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="text-sm" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              {t('Cancel', 'إلغاء')}
            </Button>
            <Button disabled={rejectMut.isPending} onClick={() => rejectMut.mutate()}>
              {t('Reject order', 'رفض الطلب')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revertOpen} onOpenChange={setRevertOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('Revert delivery', 'التراجع عن التسليم')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t(
              'This moves the order from Delivered back to Shipped. A reason is required for audit.',
              'ينقل الطلب من «تم التسليم» إلى «خرج للتسليم». السبب مطلوب للتدقيق.',
            )}
          </p>
          <div className="space-y-2">
            <Label htmlFor="revert-reason" className="text-sm">
              {t('Reason (required)', 'السبب (مطلوب)')}
            </Label>
            <Textarea id="revert-reason" value={revertReason} onChange={(e) => setRevertReason(e.target.value)} className="text-sm" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevertOpen(false)}>
              {t('Cancel', 'إلغاء')}
            </Button>
            <Button disabled={revertDeliveryMut.isPending || !revertReason.trim()} onClick={() => revertDeliveryMut.mutate()}>
              {t('Revert to shipped', 'التراجع إلى خرج للتسليم')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CreateOmsReturnDialog open={createReturnOpen} onClose={() => setCreateReturnOpen(false)} initialOrderReference={order?.orderNumber ?? id} />
    </div>
  )
}
