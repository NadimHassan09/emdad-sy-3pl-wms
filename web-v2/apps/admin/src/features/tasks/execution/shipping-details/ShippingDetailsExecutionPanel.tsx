import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { OutboundApi } from '@/api/outbound'
import { LegacyAlert as Alert, Button, StatusBadge } from '@/features/tasks/components/legacy-ui'
import { ShippingDetailsStageCard } from '@/features/outbound/ShippingDetailsStageCard'
import { QK } from '@/constants/query-keys'
import { localizedTaskTypeTitle, type TFn } from '@/lib/ui-labels/task-execution'
import { useTaskT } from '@/features/tasks/task-i18n'

type Props = {
  taskId: string
  outboundOrderId: string
  companyIdOverride?: string
  taskStatus: string
  submit: (body: unknown) => void
  busy: boolean
  readOnly?: boolean
}

export function ShippingDetailsExecutionPanel({
  outboundOrderId,
  taskStatus,
  submit,
  busy,
  readOnly = false,
}: Props) {
  const { t, isArabic } = useTaskT()
  const isCompleted = taskStatus === 'completed' || readOnly

  const orderQuery = useQuery({
    queryKey: [...QK.outboundOrders, outboundOrderId],
    queryFn: () => OutboundApi.get(outboundOrderId),
    enabled: !!outboundOrderId,
  })

  const order = orderQuery.data
  const carrierMethod = order?.shippingMethod === 'carrier'
  const shipmentCreated = order?.carrierShipments?.some((s) => s.status === 'created') ?? false

  const pending = busy

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{localizedTaskTypeTitle('shipping_details', t as TFn)}</h2>
          {order ? (
            <Link to={`/orders/outbound/${order.id}`} className="text-sm font-medium text-primary hover:underline">
              {order.orderNumber}
            </Link>
          ) : null}
        </div>
        <StatusBadge status={taskStatus} />
      </div>

      {carrierMethod && !shipmentCreated ? (
        <Alert variant="info" title={t(['Admin sends to carrier', 'المسؤول يرسل للناقل'])}>
          {t([
            'Save package details below. An admin sends the carrier shipment from the outbound order when ready.',
            'احفظ تفاصيل الطرد أدناه. يرسل المسؤول شحنة الناقل من صفحة الطلب الصادر عند الجاهزية.',
          ])}
        </Alert>
      ) : null}

      {orderQuery.isError ? (
        <Alert variant="error" title={t(['Failed to load order', 'فشل تحميل الطلب'])}>
          {(orderQuery.error as Error).message}
        </Alert>
      ) : null}

      {order ? <ShippingDetailsStageCard order={order} isArabic={isArabic} /> : null}

      {!isCompleted && order && (!carrierMethod || shipmentCreated) ? (
        <Button
          type="button"
          loading={pending}
          disabled={pending}
          onClick={() => submit({ task_type: 'shipping_details' })}
        >
          {t(['Mark task complete', 'إكمال المهمة'])}
        </Button>
      ) : null}
    </div>
  )
}
