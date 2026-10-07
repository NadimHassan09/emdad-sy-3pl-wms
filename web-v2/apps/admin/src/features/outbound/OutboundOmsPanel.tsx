import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { StatusBadge } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@emdad/ui/ui/card'
import type { OmsOrderDetail } from '@/api/oms'
import { OmsApi } from '@/api/oms'
import { QK } from '@/constants/query-keys'

type TabId = 'order' | 'customer' | 'financial' | 'shipment'

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  )
}

export function OutboundOmsPanel({
  omsOrderId,
  order,
  onRefresh,
  isArabic,
}: {
  omsOrderId: string
  order: OmsOrderDetail
  onRefresh: () => void
  isArabic: boolean
}) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const [tab, setTab] = useState<TabId>('order')
  const qc = useQueryClient()

  const mut = useMutation({
    mutationFn: (action: 'allocate' | 'release' | 'out' | 'delivered' | 'returned' | 'collect' | 'settle') => {
      switch (action) {
        case 'allocate':
          return OmsApi.allocate(omsOrderId)
        case 'release':
          return OmsApi.releaseAllocation(omsOrderId)
        case 'out':
          return OmsApi.outForDelivery(omsOrderId)
        case 'delivered':
          return OmsApi.delivered(omsOrderId)
        case 'returned':
          return OmsApi.returned(omsOrderId)
        case 'collect':
          return OmsApi.collectCod(omsOrderId)
        case 'settle':
          return OmsApi.settleCod(omsOrderId)
        default:
          throw new Error('Unknown action')
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK.omsOrders })
      onRefresh()
      toast.success(t('OMS order updated.', 'تم تحديث طلب OMS.'))
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const tabs: { id: TabId; label: string }[] = [
    { id: 'order', label: t('Order', 'الطلب') },
    { id: 'customer', label: t('Customer', 'العميل') },
    { id: 'financial', label: t('Financial', 'المالي') },
    { id: 'shipment', label: t('Shipment', 'الشحن') },
  ]

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center gap-2">
        <CardTitle>{t('Linked OMS order', 'طلب OMS المرتبط')}</CardTitle>
        <StatusBadge tone="progress">{order.orderNumber}</StatusBadge>
        {order.paymentMethod === 'COD' ? (
          <StatusBadge tone="warning">COD {order.codStatus ?? 'pending'}</StatusBadge>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1 border-b pb-2">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              type="button"
              onClick={() => setTab(tb.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === tb.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {tab === 'order' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('Client reference', 'مرجع العميل')} value={order.clientReference ?? '—'} />
            <Field label={t('Payment', 'الدفع')} value={order.paymentMethod ?? '—'} />
            <Field label={t('Status', 'الحالة')} value={order.status} />
            <Field label={t('Notes', 'ملاحظات')} value={order.notes?.trim() || '—'} />
          </div>
        ) : null}

        {tab === 'customer' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('Recipient', 'المستلم')} value={order.recipientName ?? '—'} />
            <Field label={t('Phone', 'الهاتف')} value={order.recipientPhone ?? '—'} />
            <Field label={t('City', 'المدينة')} value={order.city ?? '—'} />
            <Field label={t('District', 'المنطقة')} value={order.district ?? '—'} />
          </div>
        ) : null}

        {tab === 'financial' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('Subtotal', 'المجموع')} value={order.subtotal ?? '—'} />
            <Field label={t('Shipping fee', 'رسوم الشحن')} value={order.shippingFee ?? '—'} />
            <Field label={t('COD amount', 'مبلغ COD')} value={order.codAmount ?? '—'} />
          </div>
        ) : null}

        {tab === 'shipment' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('Carrier', 'شركة الشحن')} value={order.carrier ?? '—'} />
            <Field label={t('Tracking', 'التتبع')} value={order.trackingNumber ?? '—'} />
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button type="button" variant="outline" size="sm" disabled={mut.isPending} onClick={() => mut.mutate('allocate')}>
            {t('Allocate', 'تخصيص')}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={mut.isPending} onClick={() => mut.mutate('out')}>
            {t('Out for delivery', 'خرج للتسليم')}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={mut.isPending} onClick={() => mut.mutate('delivered')}>
            {t('Mark delivered', 'تسجيل التسليم')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
