import type { ReactNode } from 'react'
import { isAxiosError } from 'axios'
import { ArrowLeft } from 'lucide-react'
import { useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { formatDateTime, useUiPreferences } from '@emdad/core'
import { ErrorState, Link, PageHeader, StatusBadge, type Tone } from '@emdad/ui'
import { Card, CardContent, CardHeader, CardTitle } from '@emdad/ui/ui/card'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { fetchClientOmsReturn, type ClientOmsReturnStatus } from '@/services/clientOmsReturnsService'

const RETURN_STATUS_TONE: Record<string, Tone> = {
  requested: 'pending',
  approved: 'ready',
  rejected: 'danger',
  in_progress: 'progress',
  completed: 'success',
  cancelled: 'neutral',
}

function returnStatusLabel(status: string, isArabic: boolean): string {
  const en: Record<string, string> = {
    requested: 'Requested',
    approved: 'Approved',
    rejected: 'Rejected',
    in_progress: 'In progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }
  const ar: Record<string, string> = {
    requested: 'مطلوب',
    approved: 'معتمد',
    rejected: 'مرفوض',
    in_progress: 'قيد التنفيذ',
    completed: 'مكتمل',
    cancelled: 'ملغي',
  }
  return (isArabic ? ar : en)[status] ?? status.replace(/_/g, ' ')
}

function DetailRow({
  label,
  value,
  className,
  preWrap,
}: {
  label: string
  value?: ReactNode
  className?: string
  preWrap?: boolean
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 text-sm text-foreground ${preWrap ? 'whitespace-pre-wrap' : ''}`}>
        {value ?? '—'}
      </dd>
    </div>
  )
}

export function OmsReturnDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const backTo = '/ecommerce-orders/returns'

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['client', 'oms-returns', id],
    queryFn: () => fetchClientOmsReturn(id),
    enabled: !!id,
  })

  const notFound = error && isAxiosError(error) && error.response?.status === 404
  const status = (data?.status ?? '') as ClientOmsReturnStatus | string

  return (
    <div className="space-y-5">
      <Link
        to={backTo}
        className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t('Back to returns', 'العودة إلى المرتجعات')}
      </Link>

      {notFound ? (
        <ErrorState title={t('Return not found.', 'المرتجع غير موجود.')} />
      ) : error ? (
        <ErrorState
          title={t('Could not load this return.', 'تعذر تحميل هذا المرتجع.')}
          description={(error as Error).message}
          retryLabel={t('Retry', 'إعادة المحاولة')}
          onRetry={() => void refetch()}
        />
      ) : null}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/5" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-52 w-full" />
        </div>
      ) : data ? (
        <>
          <PageHeader
            title={
              <span className="inline-flex flex-wrap items-center gap-3 font-mono">
                {data.returnNumber || id.slice(0, 8)}
                <StatusBadge tone={RETURN_STATUS_TONE[status] ?? 'neutral'}>
                  {returnStatusLabel(status, isArabic)}
                </StatusBadge>
              </span>
            }
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('Return details', 'تفاصيل المرتجع')}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <DetailRow
                  label={t('Original order', 'الطلب الأصلي')}
                  value={
                    data.omsOrder ? (
                      <Link
                        to={`/ecommerce-orders/${data.omsOrder.id}`}
                        className="font-mono text-primary hover:underline"
                      >
                        {data.omsOrder.orderNumber}
                      </Link>
                    ) : (
                      '—'
                    )
                  }
                />
                <DetailRow
                  label={t('Created', 'تاريخ الإنشاء')}
                  value={formatDateTime(data.createdAt, locale)}
                />
                {data.warehouseReturn ? (
                  <DetailRow
                    label={t('Warehouse return', 'مرتجع المستودع')}
                    value={`${data.warehouseReturn.orderNumber} · ${data.warehouseReturn.status}`}
                  />
                ) : null}
                {data.notes || data.reason ? (
                  <DetailRow
                    label={t('Notes', 'ملاحظات')}
                    value={data.notes ?? data.reason}
                    className="sm:col-span-2"
                    preWrap
                  />
                ) : null}
              </dl>
            </CardContent>
          </Card>

          <Card className="overflow-hidden py-0">
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b py-4">
              <CardTitle className="text-base">{t('Line items', 'بنود المرتجع')}</CardTitle>
              <span className="text-xs font-medium text-muted-foreground">
                {data.lines?.length ?? 0}{' '}
                {(data.lines?.length ?? 0) === 1
                  ? t('item', 'بند')
                  : t('items', 'بنود')}
              </span>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-start">#</th>
                    <th className="px-4 py-2.5 text-start">{t('SKU', 'رمز المنتج')}</th>
                    <th className="px-4 py-2.5 text-start">{t('Product', 'المنتج')}</th>
                    <th className="px-4 py-2.5 text-end">{t('Expected', 'المتوقع')}</th>
                    <th className="px-4 py-2.5 text-end">{t('Received', 'المستلم')}</th>
                    <th className="px-4 py-2.5 text-start">{t('Status', 'الحالة')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(data.lines ?? []).map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-2.5 text-muted-foreground">{line.lineNumber}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {line.product?.sku ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 font-medium">{line.product?.name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-end tabular">{line.quantity}</td>
                      <td className="px-4 py-2.5 text-end font-semibold">—</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {returnStatusLabel(status, isArabic)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  )
}
