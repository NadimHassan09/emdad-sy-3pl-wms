import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { useUiPreferences } from '@emdad/core'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { OutboundApi } from '@/api/outbound'
import { QK } from '@/constants/query-keys'
import { AdminOutboundOrderSummary } from './AdminOutboundOrderSummary'

export function OutboundDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const order = useQuery({
    queryKey: [...QK.outboundOrders, id],
    queryFn: () => OutboundApi.get(id),
    enabled: !!id,
  })

  if (!id) return null

  if (order.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    )
  }

  if (order.isError || !order.data) {
    return (
      <div className="space-y-4">
        <Link to="/orders/outbound" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {t('All outbound orders', 'كل طلبات الصادر')}
        </Link>
        <Alert className="border-tone-danger-border bg-tone-danger-bg">
          <AlertTitle>{t('Failed to load order', 'تعذر تحميل الطلب')}</AlertTitle>
          <AlertDescription>{(order.error as Error)?.message}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Link to="/orders/outbound" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t('All outbound orders', 'كل طلبات الصادر')}
      </Link>
      <AdminOutboundOrderSummary order={order.data} />
    </div>
  )
}
