import { useState } from 'react'
import { isAxiosError } from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { ConfirmDialog, ErrorState, PageHeader } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@emdad/ui/ui/card'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import {
  clientOmsCommercialStatusLabel,
  mapClientOmsCommercialDisplayStatus,
} from '@/lib/client-oms-commercial-status'
import {
  cancelClientOmsOrder,
  confirmClientOmsOrder,
  fetchClientOmsOrder,
  fetchClientOmsTimeline,
  revertCancelClientOmsOrder,
} from '@/services/clientOmsOrdersService'
import { OmsOrderTrackingPanel } from './OmsOrderTrackingPanel'
import { OmsShipmentMovementPanel } from './OmsShipmentMovementPanel'
import { Field, OmsStatusBadge, fmtMoney } from './oms-ui'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString()
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString()
}

export function EcommerceOrderDetailPage() {
  const { id = '' } = useParams()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const qc = useQueryClient()

  const [cancelOpen, setCancelOpen] = useState(false)
  const [undoCancelOpen, setUndoCancelOpen] = useState(false)

  const orderQuery = useQuery({
    queryKey: ['client', 'ecommerce-orders', id],
    queryFn: () => fetchClientOmsOrder(id),
    enabled: !!id,
  })

  const timelineQuery = useQuery({
    queryKey: ['client', 'ecommerce-orders', id, 'timeline'],
    queryFn: () => fetchClientOmsTimeline(id),
    enabled: !!id,
  })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['client', 'ecommerce-orders', id] })
    void qc.invalidateQueries({ queryKey: ['client', 'ecommerce-orders'] })
  }

  const confirmMut = useMutation({
    mutationFn: () => confirmClientOmsOrder(id),
    onSuccess: () => {
      toast.success(
        t(
          'Order confirmed (waiting for admin approval).',
          'تم تأكيد الطلب (بانتظار موافقة الإدارة).',
        ),
      )
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const cancelMut = useMutation({
    mutationFn: () => cancelClientOmsOrder(id),
    onSuccess: () => {
      toast.success(t('Order cancelled.', 'تم إلغاء الطلب.'))
      setCancelOpen(false)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const undoCancelMut = useMutation({
    mutationFn: () => revertCancelClientOmsOrder(id),
    onSuccess: () => {
      toast.success(t('Cancellation undone.', 'تم التراجع عن الإلغاء.'))
      setUndoCancelOpen(false)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const notFound =
    orderQuery.error &&
    isAxiosError(orderQuery.error) &&
    orderQuery.error.response?.status === 404

  if (orderQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="space-y-4">
        <Link
          to="/ecommerce-orders"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
          {t('Back to online orders', 'العودة إلى الطلبات الإلكترونية')}
        </Link>
        <ErrorState title={t('Online order not found.', 'الطلب الإلكتروني غير موجود.')} />
      </div>
    )
  }

  if (orderQuery.isError || !orderQuery.data) {
    return (
      <div className="space-y-4">
        <Link
          to="/ecommerce-orders"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
          {t('Back to online orders', 'العودة إلى الطلبات الإلكترونية')}
        </Link>
        <ErrorState
          title={t('Could not load this order. Please try again.', 'تعذر تحميل هذا الطلب. حاول مرة أخرى.')}
          onRetry={() => orderQuery.refetch()}
          retryLabel={t('Retry', 'إعادة المحاولة')}
        />
      </div>
    )
  }

  const order = {
    ...orderQuery.data,
    timeline: timelineQuery.data ?? orderQuery.data.timeline,
  }

  const commercial = mapClientOmsCommercialDisplayStatus(order.status)
  const rawStatus = order.status
  const canConfirm =
    !order.needsInformation &&
    (rawStatus === 'waiting_for_confirmation' || commercial === 'waiting_for_confirmation')
  const canCancel =
    rawStatus === 'waiting_for_confirmation' ||
    rawStatus === 'confirmed_waiting_for_admin_approval' ||
    rawStatus === 'pending_approval'
  const canUndoCancel = Boolean(order.canRevertCancel)
  const undoToLabel = order.revertCancelToStatus
    ? clientOmsCommercialStatusLabel(order.revertCancelToStatus, isArabic)
    : null

  return (
    <div className="space-y-5">
      <Link
        to="/ecommerce-orders"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t('Back to online orders', 'العودة إلى الطلبات الإلكترونية')}
      </Link>

      <PageHeader
        title={order.orderNumber || order.id.slice(0, 8)}
        actions={
          <div className="flex flex-wrap gap-2">
            {canConfirm ? (
              <Button
                size="sm"
                disabled={confirmMut.isPending}
                onClick={() => confirmMut.mutate()}
              >
                {confirmMut.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                {t('Confirm order', 'تأكيد الطلب')}
              </Button>
            ) : null}
            {canCancel ? (
              <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)}>
                {t('Cancel order', 'إلغاء الطلب')}
              </Button>
            ) : null}
            {canUndoCancel ? (
              <Button variant="outline" size="sm" onClick={() => setUndoCancelOpen(true)}>
                {t('Undo Cancel', 'التراجع عن الإلغاء')}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <OmsStatusBadge
          status={order.status}
          isArabic={isArabic}
          needsInformation={order.needsInformation}
        />
      </div>

      {order.rejectionReason ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          <p className="font-semibold">
            {t('Rejected', 'مرفوض')}: {order.rejectionReason}
          </p>
        </div>
      ) : null}

      {order.needsInformation ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          <p className="font-semibold">{t('Incomplete Order', 'طلب غير مكتمل')}</p>
          <p className="mt-1">
            {t(
              'Shipping/Delivery information is incomplete.',
              'معلومات الشحن/التوصيل غير مكتملة.',
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
                <div className="sm:col-span-2">
                  <Field
                    label={t('Address', 'العنوان')}
                    value={order.addressLine1 ?? order.destinationAddress ?? '—'}
                  />
                </div>
                {order.city ? <Field label={t('City', 'المدينة')} value={order.city} /> : null}
                {order.district ? (
                  <Field label={t('District', 'المنطقة')} value={order.district} />
                ) : null}
                {order.addressLine2 ? (
                  <div className="sm:col-span-2">
                    <Field
                      label={t('Detailed address', 'العنوان التفصيلي')}
                      value={order.addressLine2}
                    />
                  </div>
                ) : null}
                {order.trackingNumber ? (
                  <Field label={t('Tracking', 'رقم التتبع')} value={order.trackingNumber} />
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">{t('Line items', 'بنود الطلب')}</CardTitle>
              <span className="text-sm text-muted-foreground">
                {order.lines.length}{' '}
                {order.lines.length === 1 ? t('item', 'بند') : t('items', 'بنود')}
              </span>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-start">{t('#', '#')}</th>
                    <th className="px-4 py-2.5 text-start">{t('SKU', 'SKU')}</th>
                    <th className="px-4 py-2.5 text-start">{t('Product', 'المنتج')}</th>
                    <th className="px-4 py-2.5 text-end">{t('Qty', 'الكمية')}</th>
                    <th className="px-4 py-2.5 text-end">{t('Price', 'السعر')}</th>
                    <th className="px-4 py-2.5 text-end">{t('Line total', 'الإجمالي')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {order.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-2.5 text-muted-foreground">{line.lineNumber}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {line.product?.sku ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 font-medium">{line.product?.name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-end tabular">{line.requestedQuantity}</td>
                      <td className="px-4 py-2.5 text-end tabular">{line.unitPrice ?? '—'}</td>
                      <td className="px-4 py-2.5 text-end font-semibold tabular">
                        {line.lineTotal ?? '—'}
                      </td>
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
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t('Order details', 'تفاصيل الطلب')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label={t('Order #', 'رقم الطلب')} value={order.orderNumber} />
              <Field
                label={t('Required ship', 'تاريخ الشحن المطلوب')}
                value={formatDate(order.requiredShipDate)}
              />
              <Field label={t('Created', 'تاريخ الإنشاء')} value={formatDateTime(order.createdAt)} />
              {order.warehouseStatus ? (
                <Field
                  label={t('Warehouse status', 'حالة المستودع')}
                  value={order.warehouseStatus}
                />
              ) : null}
            </CardContent>
          </Card>

          {order.paymentMethod || order.subtotal || order.shippingFee ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t('Pricing & COD', 'التسعير والتحصيل')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {order.paymentMethod ? (
                  <Field label={t('Payment', 'طريقة الدفع')} value={order.paymentMethod} />
                ) : null}
                {order.shippingFee ? (
                  <Field
                    label={t('Shipping fee', 'رسوم الشحن')}
                    value={fmtMoney(order.shippingFee, order.currency)}
                  />
                ) : null}
                {order.subtotal ? (
                  <Field
                    label={t('Subtotal', 'الإجمالي الفرعي')}
                    value={fmtMoney(order.subtotal, order.currency)}
                  />
                ) : null}
                {order.codStatus ? (
                  <Field label={t('COD status', 'حالة التحصيل')} value={order.codStatus} />
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <OmsOrderTrackingPanel order={order} isArabic={isArabic} />
      <OmsShipmentMovementPanel order={order} isArabic={isArabic} />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        intent="danger"
        title={t('Cancel this order?', 'إلغاء هذا الطلب؟')}
        description={t(
          'The order will be cancelled. You may be able to undo this later.',
          'سيتم إلغاء الطلب. قد تتمكن من التراجع لاحقاً.',
        )}
        confirmLabel={t('Cancel order', 'إلغاء الطلب')}
        cancelLabel={t('Back', 'رجوع')}
        loading={cancelMut.isPending}
        onConfirm={() => cancelMut.mutate()}
      />

      <ConfirmDialog
        open={undoCancelOpen}
        onOpenChange={setUndoCancelOpen}
        intent="default"
        title={t('Undo cancel?', 'التراجع عن الإلغاء؟')}
        description={
          undoToLabel
            ? t(
                `Restore this order to ${undoToLabel}?`,
                `إرجاع الطلب إلى ${undoToLabel}؟`,
              )
            : t(
                'Restore this order to its previous status?',
                'إرجاع الطلب لحالته السابقة؟',
              )
        }
        confirmLabel={t('Undo Cancel', 'التراجع عن الإلغاء')}
        cancelLabel={t('Back', 'رجوع')}
        loading={undoCancelMut.isPending}
        onConfirm={() => undoCancelMut.mutate()}
      />
    </div>
  )
}
