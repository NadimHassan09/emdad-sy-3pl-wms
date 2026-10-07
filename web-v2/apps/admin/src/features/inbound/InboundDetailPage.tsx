import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { useUiPreferences } from '@emdad/core'
import { ErrorState } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { InboundApi } from '@/api/inbound'
import { QK } from '@/constants/query-keys'
import { AdminInboundOrderSummary } from './AdminInboundOrderSummary'

export function InboundDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const order = useQuery({
    queryKey: [...QK.inboundOrders, id],
    queryFn: () => InboundApi.get(id),
    enabled: !!id,
  })

  if (!id) return null

  if (order.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    )
  }

  if (order.isError || !order.data) {
    return (
      <ErrorState
        title={t('Failed to load inbound order.', 'تعذر تحميل طلب الوارد.')}
        retryLabel={t('Retry', 'إعادة المحاولة')}
        onRetry={() => void order.refetch()}
      />
    )
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ms-2 w-fit" asChild>
        <Link to="/orders/inbound">
          <ArrowLeft className="rtl:rotate-180" aria-hidden />
          {t('All inbound orders', 'كل طلبات الوارد')}
        </Link>
      </Button>
      <AdminInboundOrderSummary order={order.data} />
    </div>
  )
}
