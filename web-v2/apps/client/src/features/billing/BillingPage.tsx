import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Boxes,
  Package,
  Receipt,
  ShoppingCart,
  Undo2,
} from 'lucide-react'
import { Link } from 'react-router'
import { useUiPreferences } from '@emdad/core'
import {
  DonutChart,
  EmptyState,
  ErrorState,
  KpiCard,
  KpiStrip,
  PageHeader,
} from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@emdad/ui/ui/card'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { toast } from 'sonner'
import { buildBillingRestrictionCopy } from '@/lib/client-billing-restriction'
import { fetchClientBillingSummary } from '@/services/clientBillingService'
import { fetchClientDashboardOverview } from '@/services/clientDashboardService'
import { fetchClientInboundOrders } from '@/services/clientInboundOrdersService'
import { fetchClientOmsOrders } from '@/services/clientOmsOrdersService'
import { fetchClientOutboundOrders } from '@/services/clientOutboundOrdersService'
import { fetchClientReturns } from '@/services/clientReturnsService'
import { fetchStockPage } from '@/services/stockService'
import { BillingSubNav } from './BillingSubNav'
import {
  AccountStatusBadge,
  BILLING_CURRENCY,
  DetailField,
  SectionHeading,
  SALES_EMAIL,
  cycleCadence,
  formatDate,
  formatDecimal,
  inCycle,
  planDisplayName,
} from './billing-ui'

const INCLUDED_FEATURES = [
  { en: 'OMS', ar: 'نظام الطلبات' },
  { en: 'WMS', ar: 'نظام المستودع' },
] as const

export function BillingPage() {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const summaryQuery = useQuery({
    queryKey: ['client', 'billing', 'summary'],
    queryFn: fetchClientBillingSummary,
  })

  const overviewQuery = useQuery({
    queryKey: ['client', 'dashboard', 'overview'],
    queryFn: fetchClientDashboardOverview,
    staleTime: 60_000,
  })

  const stockQuery = useQuery({
    queryKey: ['client', 'billing', 'stock-usage'],
    queryFn: () => fetchStockPage({ limit: 200, offset: 0 }),
    staleTime: 60_000,
  })

  const summary = summaryQuery.data
  const plan = summary?.plan ?? null
  const cycle = summary?.currentCycle ?? null
  const cycleStart = cycle?.startsAt
  const cycleEnd = cycle?.endsAt

  const inboundQuery = useQuery({
    queryKey: ['client', 'billing', 'inbound-cycle', cycleStart, cycleEnd],
    queryFn: () => fetchClientInboundOrders({ limit: 200, offset: 0 }),
    enabled: !!plan,
  })

  const outboundQuery = useQuery({
    queryKey: ['client', 'billing', 'outbound-cycle', cycleStart, cycleEnd],
    queryFn: () => fetchClientOutboundOrders({ limit: 200, offset: 0 }),
    enabled: !!plan,
  })

  const omsQuery = useQuery({
    queryKey: ['client', 'billing', 'oms-cycle', cycleStart, cycleEnd],
    queryFn: () => fetchClientOmsOrders({ limit: 200, offset: 0 }),
    enabled: !!plan,
  })

  const returnsQuery = useQuery({
    queryKey: ['client', 'billing', 'returns-cycle', cycleStart, cycleEnd],
    queryFn: () => fetchClientReturns({ limit: 200, offset: 0 }),
    enabled: !!plan,
  })

  const notice = useMemo(() => {
    if (!summary) return null
    return buildBillingRestrictionCopy(
      summary.accountStatus === 'restricted'
        ? 'restricted'
        : summary.accountStatus === 'expiring'
          ? 'expiring'
          : plan
            ? 'active'
            : 'no_plan',
      summary.daysRemaining,
      isArabic,
    )
  }, [summary, plan, isArabic])

  const storage = overviewQuery.data?.storage
  const usedVolume = Number(storage?.usedVolumeCbm ?? 0)
  const totalVolume = Number(
    storage?.reservedVolumeCbm ?? summary?.reservedVolume ?? plan?.reservedVolume ?? 0,
  )
  const remainingVolume =
    storage?.remainingVolumeCbm != null
      ? Number(storage.remainingVolumeCbm)
      : totalVolume > 0
        ? Math.max(0, totalVolume - usedVolume)
        : 0

  const skuCount = stockQuery.data?.total ?? overviewQuery.data?.productsCount ?? 0
  const totalItems = useMemo(() => {
    const rows = stockQuery.data?.items ?? []
    return rows.reduce((sum, row) => sum + (Number(row.onHand) || 0), 0)
  }, [stockQuery.data])

  const inboundCycle = useMemo(() => {
    const rows = inboundQuery.data?.items ?? []
    return rows.filter((r) => inCycle(r.createdAt, cycleStart, cycleEnd)).length
  }, [inboundQuery.data, cycleStart, cycleEnd])

  const outboundCycle = useMemo(() => {
    const rows = outboundQuery.data?.items ?? []
    return rows.filter((r) => inCycle(r.createdAt, cycleStart, cycleEnd)).length
  }, [outboundQuery.data, cycleStart, cycleEnd])

  const omsCycle = useMemo(() => {
    const rows = omsQuery.data?.items ?? []
    return rows.filter((r) => inCycle(r.createdAt, cycleStart, cycleEnd)).length
  }, [omsQuery.data, cycleStart, cycleEnd])

  const returnsCycle = useMemo(() => {
    const rows = returnsQuery.data?.items ?? []
    return rows.filter((r) => inCycle(r.createdAt, cycleStart, cycleEnd)).length
  }, [returnsQuery.data, cycleStart, cycleEnd])

  const ordersTotal = inboundCycle + outboundCycle

  async function copySalesEmail() {
    try {
      await navigator.clipboard.writeText(SALES_EMAIL)
      toast.success(t('Copied', 'تم النسخ'))
    } catch {
      toast.error(t('Could not copy email', 'تعذر نسخ البريد'))
    }
  }

  if (summaryQuery.isLoading) {
    return (
      <div className="space-y-5">
        <BillingSubNav />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-52 w-full" />
      </div>
    )
  }

  if (summaryQuery.isError) {
    return (
      <div className="space-y-5">
        <BillingSubNav />
        <ErrorState
          title={t('Could not load billing', 'تعذر تحميل الفوترة')}
          description={(summaryQuery.error as Error)?.message}
          retryLabel={t('Retry', 'إعادة المحاولة')}
          onRetry={() => void summaryQuery.refetch()}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <BillingSubNav />
      <PageHeader
        title={t('Billing', 'الفوترة')}
        description={t(
          'Manage your subscription and resource usage',
          'إدارة اشتراكك واستخدام الموارد',
        )}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/invoices">{t('View all invoices', 'عرض كل الفواتير')}</Link>
          </Button>
        }
      />

      {notice?.showBanner ? (
        <Alert variant={notice.variant === 'error' ? 'destructive' : 'default'}>
          <AlertTitle>{notice.title}</AlertTitle>
          <AlertDescription>{notice.description}</AlertDescription>
        </Alert>
      ) : null}

      {!plan ? (
        <EmptyState
          icon={Receipt}
          title={t('No active billing plan on file.', 'لا توجد خطة فوترة نشطة.')}
          description={t(
            'Contact your account manager to set up a subscription.',
            'تواصل مع مدير حسابك لإعداد الاشتراك.',
          )}
          action={
            <Button type="button" onClick={() => void copySalesEmail()}>
              {t('Contact sales', 'تواصل مع المبيعات')}
              <span className="ms-2 text-xs opacity-80" dir="ltr">
                {SALES_EMAIL}
              </span>
            </Button>
          }
        />
      ) : (
        <>
          <Card className="border-s-4 border-s-primary">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('Current subscription', 'الاشتراك الحالي')}
                </p>
                <CardTitle className="mt-1 text-2xl">
                  {planDisplayName(plan.cycleLengthDays, isArabic)}
                </CardTitle>
              </div>
              {summary ? (
                <AccountStatusBadge status={summary.accountStatus} isArabic={isArabic} />
              ) : null}
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <DetailField
                  label={t('Price', 'السعر')}
                  value={`${formatDecimal(plan.fixedSubscriptionFee)} ${BILLING_CURRENCY}`}
                  mono
                />
                <DetailField
                  label={t('Billing cycle', 'دورة الفوترة')}
                  value={cycleCadence(plan.cycleLengthDays, isArabic)}
                />
                <DetailField
                  label={t('Next billing', 'الفوترة التالية')}
                  value={formatDate(cycle?.endsAt)}
                />
                <DetailField
                  label={t('Capacity', 'السعة')}
                  value={
                    totalVolume > 0
                      ? `${formatDecimal(totalVolume, 2)} ${t('m³', 'م³')}`
                      : '—'
                  }
                  mono
                />
              </dl>
            </CardContent>
          </Card>

          <div>
            <SectionHeading
              title={t('Current resource usage', 'استخدام الموارد الحالي')}
              subtitle={t(
                'Live utilization of your subscription',
                'الاستخدام الحي لاشتراكك',
              )}
            />
            <KpiStrip>
              <KpiCard
                title={t('Inventory', 'المخزون')}
                value={formatDecimal(totalItems, 0)}
                icon={Boxes}
                footer={
                  <span>
                    {t('Total SKUs', 'إجمالي المنتجات')}: {skuCount}
                  </span>
                }
              />
              <KpiCard
                title={t('Orders this billing cycle', 'طلبات دورة الفوترة الحالية')}
                value={String(ordersTotal)}
                icon={Package}
                footer={
                  <span>
                    {t('Inbound', 'وارد')}: {inboundCycle} · {t('Outbound', 'صادر')}:{' '}
                    {outboundCycle}
                  </span>
                }
              />
              <KpiCard
                title={t('OMS orders this billing cycle', 'طلبات إلكترونية في دورة الفوترة')}
                value={String(omsCycle)}
                icon={ShoppingCart}
              />
              <KpiCard
                title={t('Returns this billing cycle', 'مرتجعات دورة الفوترة الحالية')}
                value={String(returnsCycle)}
                icon={Undo2}
              />
            </KpiStrip>
          </div>

          {totalVolume > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t('Warehouse capacity', 'سعة المستودع')}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <DonutChart
                  data={[
                    {
                      key: 'used',
                      label: t('Used', 'مستخدم'),
                      value: Math.max(0, usedVolume),
                      color: 'var(--chart-1)',
                    },
                    {
                      key: 'remaining',
                      label: t('Remaining', 'متبقي'),
                      value: Math.max(0, remainingVolume),
                      color: 'var(--muted)',
                    },
                  ]}
                  centerValue={formatDecimal(usedVolume, 2)}
                  centerLabel={t('m³ used', 'م³ مستخدم')}
                />
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div>
                    {t('Used', 'مستخدم')}: {formatDecimal(usedVolume, 2)} {t('m³', 'م³')}
                  </div>
                  <div>
                    {t('Remaining', 'متبقي')}: {formatDecimal(remainingVolume, 2)}{' '}
                    {t('m³', 'م³')}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div>
            <SectionHeading
              title={t('Included features', 'الميزات المشمولة')}
              subtitle={t('What your subscription unlocks', 'ما يتيحه اشتراكك')}
            />
            <div className="flex flex-wrap gap-2">
              {INCLUDED_FEATURES.map((f) => (
                <span
                  key={f.en}
                  className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-800"
                >
                  {t(f.en, f.ar)}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
