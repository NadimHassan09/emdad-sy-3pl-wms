import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { DollarSign, FileText, AlertTriangle, Users } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { KpiCard, KpiStrip, PageHeader, Widget, WidgetEmpty, WidgetError, WidgetLink } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { BillingApi } from '@/api/billing'
import { QK } from '@/constants/query-keys'
import { formatDate, formatDecimal } from '@/lib/billing-invoice-display'
import { BillingSubNav } from './BillingSubNav'
import { BILLING_CURRENCY, InvoiceStatusBadge } from './billing-ui'

export function BillingDashboardPage() {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const summaryQuery = useQuery({
    queryKey: QK.billing.dashboardSummary,
    queryFn: () => BillingApi.getDashboardSummary(),
  })

  const expiringQuery = useQuery({
    queryKey: QK.billing.expiringSoon,
    queryFn: () => BillingApi.listExpiringSoon(8),
  })

  const recentQuery = useQuery({
    queryKey: QK.billing.recentInvoices,
    queryFn: () => BillingApi.listRecentInvoices(8),
  })

  const overdueQuery = useQuery({
    queryKey: QK.billing.overdueClients,
    queryFn: () => BillingApi.listOverdueClients(8),
  })

  const summary = summaryQuery.data

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Billing dashboard', 'لوحة الفوترة')}
        description={t(
          'Subscription revenue, open invoices, and upcoming renewals.',
          'إيرادات الاشتراك والفواتير المفتوحة والتجديدات القادمة.',
        )}
      />
      <BillingSubNav />

      {summaryQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('Could not load summary', 'تعذر تحميل الملخص')}</AlertTitle>
          <AlertDescription>{(summaryQuery.error as Error).message}</AlertDescription>
        </Alert>
      ) : null}

      <KpiStrip>
        <KpiCard
          title={t('Revenue this month', 'إيرادات هذا الشهر')}
          value={`${formatDecimal(summary?.currentMonthRevenue ?? 0)} ${BILLING_CURRENCY}`}
          icon={DollarSign}
          loading={summaryQuery.isPending}
        />
        <KpiCard
          title={t('Outstanding amount', 'المبلغ المستحق')}
          value={`${formatDecimal(summary?.outstandingAmount ?? 0)} ${BILLING_CURRENCY}`}
          icon={DollarSign}
          loading={summaryQuery.isPending}
        />
        <KpiCard
          title={t('Open invoices', 'فواتير مفتوحة')}
          value={summary?.openInvoiceCount ?? '—'}
          icon={FileText}
          loading={summaryQuery.isPending}
          href="/billing/invoices"
        />
        <KpiCard
          title={t('Overdue invoices', 'فواتير متأخرة')}
          value={summary?.overdueInvoiceCount ?? '—'}
          icon={AlertTriangle}
          loading={summaryQuery.isPending}
        />
        <KpiCard
          title={t('Suspended accounts', 'حسابات موقوفة')}
          value={summary?.suspendedAccountCount ?? '—'}
          icon={Users}
          loading={summaryQuery.isPending}
        />
      </KpiStrip>

      <div className="grid gap-4 lg:grid-cols-2">
        <Widget
          title={t('Cycles expiring soon', 'دورات تنتهي قريباً')}
          action={<WidgetLink to="/billing/plans">{t('View plans', 'عرض الخطط')}</WidgetLink>}
        >
          {expiringQuery.isError ? (
            <WidgetError
              message={(expiringQuery.error as Error).message}
              retryLabel={t('Retry', 'إعادة المحاولة')}
              onRetry={() => void expiringQuery.refetch()}
            />
          ) : expiringQuery.isPending ? (
            <p className="text-sm text-muted-foreground">{t('Loading…', 'جاري التحميل…')}</p>
          ) : (expiringQuery.data ?? []).length === 0 ? (
            <WidgetEmpty>{t('No cycles expiring soon.', 'لا توجد دورات تنتهي قريباً.')}</WidgetEmpty>
          ) : (
            <ul className="divide-y">
              {(expiringQuery.data ?? []).map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="min-w-0">
                    <Link
                      to={`/billing/plans/${row.companyId}`}
                      className="font-medium hover:underline"
                    >
                      {row.company.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {t('Ends', 'تنتهي')} {formatDate(row.endsAt)} · {row.daysRemaining}d
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget
          title={t('Recent invoices', 'أحدث الفواتير')}
          action={<WidgetLink to="/billing/invoices">{t('View all', 'عرض الكل')}</WidgetLink>}
        >
          {recentQuery.isError ? (
            <WidgetError
              message={(recentQuery.error as Error).message}
              retryLabel={t('Retry', 'إعادة المحاولة')}
              onRetry={() => void recentQuery.refetch()}
            />
          ) : recentQuery.isPending ? (
            <p className="text-sm text-muted-foreground">{t('Loading…', 'جاري التحميل…')}</p>
          ) : (recentQuery.data ?? []).length === 0 ? (
            <WidgetEmpty>{t('No invoices yet.', 'لا توجد فواتير بعد.')}</WidgetEmpty>
          ) : (
            <ul className="divide-y">
              {(recentQuery.data ?? []).map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="min-w-0">
                    <Link
                      to={`/billing/invoices/${row.id}`}
                      className="font-mono text-xs font-semibold hover:underline"
                      dir="ltr"
                    >
                      {row.invoiceNumber}
                    </Link>
                    <p className="truncate text-muted-foreground">{row.companyName}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="tabular-nums font-medium">
                      {formatDecimal(row.totalAmount)} {BILLING_CURRENCY}
                    </span>
                    <InvoiceStatusBadge status={row.status} isArabic={isArabic} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget
          title={t('Overdue clients', 'عملاء متأخرون')}
          className="lg:col-span-2"
          action={<WidgetLink to="/billing/plans">{t('Review billing', 'مراجعة الفوترة')}</WidgetLink>}
        >
          {overdueQuery.isError ? (
            <WidgetError
              message={(overdueQuery.error as Error).message}
              retryLabel={t('Retry', 'إعادة المحاولة')}
              onRetry={() => void overdueQuery.refetch()}
            />
          ) : overdueQuery.isPending ? (
            <p className="text-sm text-muted-foreground">{t('Loading…', 'جاري التحميل…')}</p>
          ) : (overdueQuery.data ?? []).length === 0 ? (
            <WidgetEmpty>{t('No overdue clients.', 'لا يوجد عملاء متأخرون.')}</WidgetEmpty>
          ) : (
            <ul className="divide-y">
              {(overdueQuery.data ?? []).map((row) => (
                <li key={row.companyId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <Link to={`/billing/plans/${row.companyId}`} className="font-medium hover:underline">
                    {row.companyName}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {t('Restricted since', 'مقيّد منذ')} {formatDate(row.restrictedSince)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Widget>
      </div>
    </div>
  )
}
