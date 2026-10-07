import { isAxiosError } from 'axios'
import { ArrowLeft, Package } from 'lucide-react'
import { useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { formatDate, formatDateTime, useUiPreferences } from '@emdad/core'
import { ErrorState, Link, PageHeader } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@emdad/ui/ui/card'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { clientMediaSrc } from '@/lib/client-media'
import { fetchClientInboundOrder } from '@/services/clientInboundOrdersService'
import { DetailRow, fmtQty, InboundStatusBadge } from './inbound-ui'

export function InboundDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['client', 'inbound-orders', id],
    queryFn: () => fetchClientInboundOrder(id),
    enabled: !!id,
  })

  const notFound = error && isAxiosError(error) && error.response?.status === 404

  return (
    <div className="space-y-5">
      <Link
        to="/inbound-orders"
        className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t('Back to inbound orders', 'العودة إلى طلبات الوارد')}
      </Link>

      {notFound ? (
        <ErrorState title={t('Inbound order not found.', 'طلب الوارد غير موجود.')} />
      ) : error ? (
        <ErrorState
          title={t('Could not load this order. Please try again.', 'تعذر تحميل هذا الطلب. حاول مرة أخرى.')}
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
                {data.orderNumber || data.id.slice(0, 8)}
                <InboundStatusBadge status={data.status} isArabic={isArabic} />
              </span>
            }
          />

          {data.status === 'pending_approval' ? (
            <Alert>
              <AlertTitle>
                {t('Waiting for approval', 'بانتظار الموافقة')}
              </AlertTitle>
              <AlertDescription>
                {t(
                  'This order is waiting for warehouse approval. Processing will begin after approval.',
                  'هذا الطلب بانتظار موافقة المستودع. ستبدأ المعالجة بعد الموافقة.',
                )}
              </AlertDescription>
            </Alert>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('Order details', 'تفاصيل الطلب')}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <DetailRow label={t('Order #', 'رقم الطلب')} value={data.orderNumber} />
                <DetailRow
                  label={t('Number of SKUs', 'عدد أصناف SKU')}
                  value={String(
                    new Set(data.lines.map((line) => line.product.sku || line.product.id)).size,
                  )}
                />
                <DetailRow
                  label={t('Expected arrival', 'الوصول المتوقع')}
                  value={formatDate(data.expectedArrivalDate, locale)}
                />
                <DetailRow
                  label={t('Created', 'تاريخ الإنشاء')}
                  value={formatDateTime(data.createdAt, locale)}
                />
                {data.clientReference ? (
                  <DetailRow
                    label={t('Your reference', 'مرجعك')}
                    value={data.clientReference}
                  />
                ) : null}
                {data.confirmedAt ? (
                  <DetailRow
                    label={t('Confirmed', 'تاريخ التأكيد')}
                    value={formatDateTime(data.confirmedAt, locale)}
                  />
                ) : null}
                {data.completedAt ? (
                  <DetailRow
                    label={t('Completed', 'تاريخ الإكمال')}
                    value={formatDateTime(data.completedAt, locale)}
                  />
                ) : null}
                <DetailRow
                  label={t('Notes', 'ملاحظات')}
                  value={data.notes?.trim() || '—'}
                  className="sm:col-span-2"
                  preWrap
                />
              </dl>
            </CardContent>
          </Card>

          <Card className="overflow-hidden py-0">
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b py-4">
              <CardTitle className="text-base">{t('Line items', 'بنود الطلب')}</CardTitle>
              <span className="text-xs font-medium text-muted-foreground">
                {data.lines.length}{' '}
                {data.lines.length === 1 ? t('item', 'بند') : t('items', 'بنود')}
              </span>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-start">#</th>
                    <th className="px-4 py-2.5 text-start">{t('Image', 'صورة')}</th>
                    <th className="px-4 py-2.5 text-start">{t('Product', 'المنتج')}</th>
                    <th className="px-4 py-2.5 text-start">{t('SKU', 'رمز المنتج')}</th>
                    <th className="px-4 py-2.5 text-end">{t('Expected', 'المتوقع')}</th>
                    <th className="px-4 py-2.5 text-end">{t('Received', 'المستلم')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.lines.map((line) => {
                    const imageSrc = clientMediaSrc(
                      line.product.imageUrl ??
                        (line.product.imagePath
                          ? `/media/${line.product.imagePath.replace(/^\/+/, '')}`
                          : null),
                    )
                    return (
                      <tr key={line.id}>
                        <td className="px-4 py-2.5 text-muted-foreground">{line.lineNumber}</td>
                        <td className="px-4 py-2.5">
                          {imageSrc ? (
                            <img
                              src={imageSrc}
                              alt=""
                              className="size-10 rounded-lg border object-cover"
                            />
                          ) : (
                            <div className="flex size-10 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                              <Package className="size-4" aria-hidden />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-medium">{line.product.name}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                          {line.product.sku}
                        </td>
                        <td className="px-4 py-2.5 text-end tabular">
                          {fmtQty(line.expectedQuantity)}
                        </td>
                        <td className="px-4 py-2.5 text-end font-semibold tabular">
                          {fmtQty(line.receivedQuantity)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  )
}
