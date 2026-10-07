import { useEffect } from 'react'
import { isAxiosError } from 'axios'
import { useParams, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { ErrorState, Link, PageHeader } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@emdad/ui/ui/card'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { lineTotalByType, parseRateSnapshot } from '@/lib/billing-display'
import { fetchClientInvoice } from '@/services/clientBillingService'
import {
  BILLING_CURRENCY,
  ChargeRow,
  DetailField,
  InvoiceStatusBadge,
  TimelineItem,
  formatCycleLabel,
  formatDate,
  formatDecimal,
  invoiceStatusLabel,
} from './billing-ui'

export function InvoiceDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const shouldPrint = searchParams.get('print') === '1'

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['client', 'billing', 'invoices', id],
    queryFn: () => fetchClientInvoice(id),
    enabled: !!id,
  })

  useEffect(() => {
    if (!shouldPrint || !data || isLoading) return
    const timer = window.setTimeout(() => {
      window.print()
      const next = new URLSearchParams(searchParams)
      next.delete('print')
      setSearchParams(next, { replace: true })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [shouldPrint, data, isLoading, searchParams, setSearchParams])

  const notFound = error && isAxiosError(error) && error.response?.status === 404
  const snapshot = parseRateSnapshot(data?.billingCycle?.rateSnapshot)
  const lines = data?.lines ?? []
  const cycle = data?.billingCycle
  const paymentDate = data?.status === 'paid' ? formatDate(data.updatedAt) : '—'

  return (
    <div className="space-y-5">
      <Link
        to="/invoices"
        className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground print:hidden"
      >
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t('Back to invoices', 'العودة إلى الفواتير')}
      </Link>

      {notFound ? (
        <ErrorState
          title={t('Invoice not found', 'الفاتورة غير موجودة')}
          description={t(
            'This invoice is missing or you do not have access.',
            'الفاتورة غير موجودة أو ليس لديك صلاحية الوصول.',
          )}
        />
      ) : error ? (
        <ErrorState
          title={t('Could not load this invoice', 'تعذر تحميل هذه الفاتورة')}
          description={t('Please try again.', 'حاول مرة أخرى.')}
          retryLabel={t('Retry', 'إعادة المحاولة')}
          onRetry={() => void refetch()}
        />
      ) : null}

      {isLoading ? (
        <div className="space-y-4" aria-busy>
          <Skeleton className="h-8 w-2/5" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-52 w-full" />
        </div>
      ) : null}

      {data ? (
        <>
          <PageHeader
            title={
              <span className="inline-flex flex-wrap items-center gap-3">
                {t('Invoice', 'فاتورة')}{' '}
                <span className="font-mono" dir="ltr">
                  {data.invoiceNumber}
                </span>
                <InvoiceStatusBadge status={data.status} isArabic={isArabic} />
              </span>
            }
            actions={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="print:hidden"
                onClick={() => window.print()}
              >
                <Printer className="size-4" aria-hidden />
                {t('Print', 'طباعة')}
              </Button>
            }
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('Summary', 'ملخص')}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <DetailField label={t('Billing period', 'فترة الفوترة')} value={formatCycleLabel(cycle)} />
                <DetailField
                  label={t('Invoice date', 'تاريخ الفاتورة')}
                  value={formatDate(data.issuedAt ?? data.createdAt)}
                />
                <DetailField label={t('Due date', 'تاريخ الاستحقاق')} value={formatDate(data.dueDate)} />
                <DetailField label={t('Created', 'تاريخ الإنشاء')} value={formatDate(data.createdAt)} />
                <DetailField
                  label={t('Amount', 'المبلغ')}
                  value={`${formatDecimal(data.grandTotal ?? data.totalAmount)} ${BILLING_CURRENCY}`}
                  mono
                />
                <DetailField label={t('Currency', 'العملة')} value={BILLING_CURRENCY} />
                <DetailField
                  label={t('Payment status', 'حالة الدفع')}
                  value={invoiceStatusLabel(data.status, isArabic)}
                />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('Billing plan snapshot', 'لقطة خطة الفوترة')}</CardTitle>
            </CardHeader>
            <CardContent>
              {snapshot ? (
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  <DetailField
                    label={t('Fixed subscription fee', 'رسوم الاشتراك الثابتة')}
                    value={`${formatDecimal(snapshot.fixedSubscriptionFee)} ${BILLING_CURRENCY}`}
                    mono
                  />
                  <DetailField
                    label={t('Reserved volume', 'الحجم المحجوز')}
                    value={`${formatDecimal(snapshot.reservedVolume, 4)} ${t('m³', 'م³')}`}
                    mono
                  />
                  {snapshot.snapshottedAt ? (
                    <DetailField
                      label={t('Snapshotted at', 'تاريخ اللقطة')}
                      value={formatDate(snapshot.snapshottedAt)}
                    />
                  ) : null}
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t('No rate snapshot for this billing cycle.', 'لا توجد لقطة أسعار لهذه الدورة.')}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('Line items & charges', 'البنود والرسوم')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border bg-muted/30 px-4 py-1">
                <ChargeRow
                  label={t('Fixed subscription', 'الاشتراك الثابت')}
                  amount={lineTotalByType(lines, 'subscription')}
                />
                {lines
                  .filter(
                    (l) =>
                      l.lineSource === 'manual' ||
                      l.lineSource === 'order' ||
                      l.type === 'manual' ||
                      l.type === 'order_charge',
                  )
                  .map((line) => (
                    <ChargeRow
                      key={line.id}
                      label={line.description ?? line.type}
                      amount={line.totalPrice}
                    />
                  ))}
                <ChargeRow
                  label={t('Subtotal', 'المجموع الفرعي')}
                  amount={data.subtotalAmount ?? data.totalAmount}
                />
                {Number(data.discountAmount ?? 0) > 0 ? (
                  <ChargeRow label={t('Discount', 'الخصم')} amount={`-${data.discountAmount}`} />
                ) : null}
                {Number(data.vatAmount ?? 0) > 0 ? (
                  <ChargeRow
                    label={`${t('Taxes', 'الضرائب')} (${formatDecimal(data.vatPercentage ?? '0', 2)}%)`}
                    amount={data.vatAmount ?? '0'}
                  />
                ) : null}
                <ChargeRow
                  label={t('Grand total', 'الإجمالي')}
                  amount={data.grandTotal ?? data.totalAmount}
                  emphasize
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('Payment information', 'معلومات الدفع')}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <DetailField
                  label={t('Payment status', 'حالة الدفع')}
                  value={invoiceStatusLabel(data.status, isArabic)}
                />
                <DetailField label={t('Due date', 'تاريخ الاستحقاق')} value={formatDate(data.dueDate)} />
                <DetailField label={t('Payment date', 'تاريخ الدفع')} value={paymentDate} />
                <DetailField
                  label={t('Amount', 'المبلغ')}
                  value={`${formatDecimal(data.grandTotal ?? data.totalAmount)} ${BILLING_CURRENCY}`}
                  mono
                />
                <DetailField label={t('Currency', 'العملة')} value={BILLING_CURRENCY} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('Invoice timeline', 'الجدول الزمني للفاتورة')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="m-0 list-none p-0">
                <TimelineItem label={t('Invoice created', 'إنشاء الفاتورة')} value={formatDate(data.createdAt)} />
                {data.issuedAt ? (
                  <TimelineItem label={t('Invoice issued', 'إصدار الفاتورة')} value={formatDate(data.issuedAt)} />
                ) : null}
                {data.dueDate ? (
                  <TimelineItem label={t('Payment due', 'استحقاق الدفع')} value={formatDate(data.dueDate)} />
                ) : null}
                {data.status === 'paid' ? (
                  <TimelineItem label={t('Marked paid', 'تم التسديد')} value={paymentDate} />
                ) : null}
              </ul>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
