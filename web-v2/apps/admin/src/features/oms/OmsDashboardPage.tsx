import { useMemo, useState, type ComponentType } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  Bell,
  Box,
  Check,
  CircleCheck,
  Clock,
  DollarSign,
  Package,
  Plus,
  RefreshCw,
  ShoppingCart,
  Truck,
  Wallet,
  X,
  Banknote,
} from 'lucide-react'
import { formatCurrency, formatDateTime, formatNumber, formatRelative, useUiPreferences } from '@emdad/core'
import {
  DataTable,
  Delta,
  DonutChart,
  ErrorState,
  FilterBar,
  KpiCard,
  KpiStrip,
  LegendList,
  LineSeriesChart,
  Link,
  PageHeader,
  ResetFiltersButton,
  StatusBadge,
  Widget,
  WidgetEmpty,
  WidgetError,
  WidgetLink,
  cn,
  toneClasses,
  useNavigate,
  type Tone,
} from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { CompaniesApi } from '@/api/companies'
import type { OmsDashboardSummary } from '@/api/oms'
import { OmsApi } from '@/api/oms'
import { QK } from '@/constants/query-keys'
import { aggregateCommercialStatusCounts, omsCommercialStatusLabel } from '@/lib/oms-commercial-status'
import { OmsStatusBadge, omsStatusTone } from './oms-ui'

type DateRangePreset = 'this_month' | 'last_7_days' | 'last_month' | 'custom'

type SummaryDraft = {
  preset: DateRangePreset
  createdFrom: string
  createdTo: string
  companyId: string
}

const ALL = '__all__'

function toYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

function datesForPreset(preset: Exclude<DateRangePreset, 'custom'>): { from: string; to: string } {
  const now = new Date()
  if (preset === 'last_7_days') {
    const from = new Date(now)
    from.setDate(from.getDate() - 6)
    return { from: toYmd(from), to: toYmd(now) }
  }
  if (preset === 'last_month') {
    const base = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return { from: toYmd(startOfMonth(base)), to: toYmd(endOfMonth(base)) }
  }
  return { from: toYmd(startOfMonth(now)), to: toYmd(endOfMonth(now)) }
}

function defaultSummaryFilters(): SummaryDraft {
  const { from, to } = datesForPreset('this_month')
  return { preset: 'this_month', createdFrom: from, createdTo: to, companyId: '' }
}

function parseAmount(value: string | number | null | undefined): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

const WAITING = new Set([
  'draft',
  'waiting_for_confirmation',
  'confirmed_waiting_for_admin_approval',
  'pending_approval',
])
const PENDING_FULFILLMENT = new Set([
  'pending',
  'approved',
  'confirmed',
  'processing',
  'allocated',
  'picking',
  'packing',
  'ready_to_ship',
])
const OUT_FOR_DELIVERY = new Set(['shipped', 'out_for_delivery'])
const DELIVERED = new Set(['delivered', 'completed'])
const RETURNED = new Set(['returned'])
const CANCELLED_OR_FAILED = new Set(['cancelled', 'rejected', 'failed_delivery'])

function sumBucket(rows: Array<{ status: string; count: number }> | undefined, bucket: Set<string>): number {
  let n = 0
  for (const row of rows ?? []) {
    if (bucket.has(row.status)) n += row.count
  }
  return n
}

function SummaryTile({
  label,
  count,
  total,
  tone,
  locale,
  className,
}: {
  label: string
  count: number
  total: number
  tone: Tone | null
  locale: string
  className?: string
}) {
  const t = tone ? toneClasses[tone] : null
  return (
    <div className={cn('min-w-0 rounded-xl border px-3 py-3', t ? [t.bg, t.border] : 'bg-card', className)}>
      <p className={cn('tabular text-2xl font-semibold leading-8', t ? t.text : 'text-foreground')}>
        {formatNumber(count, locale)}
      </p>
      <p className={cn('text-sm font-medium leading-5', t ? t.text : 'text-muted-foreground')}>{label}</p>
      <p className={cn('tabular text-xs', t ? t.text : 'text-muted-foreground')}>
        {total > 0 ? `${((count / total) * 100).toFixed(1)}%` : '0%'}
      </p>
    </div>
  )
}

type LiveEvent = NonNullable<OmsDashboardSummary['liveActivity']>[number]

function eventLabel(ev: LiveEvent, isArabic: boolean): string {
  const order = ev.orderNumber
    ? isArabic
      ? `طلب ${ev.orderNumber}`
      : `Order ${ev.orderNumber}`
    : isArabic
      ? 'طلب'
      : 'Order'
  const by = ev.actorName ? (isArabic ? ` — ${ev.actorName}` : ` by ${ev.actorName}`) : ''
  const t = ev.eventType.replace(/^order\./, '').replace(/_/g, ' ')
  return `${order} ${t}${by}`
}

function eventVisual(eventType: string): { Icon: ComponentType<{ className?: string }>; tone: Tone } {
  if (eventType.includes('approved')) return { Icon: Check, tone: 'success' }
  if (eventType.includes('packed') || eventType.includes('packing')) return { Icon: Package, tone: 'progress' }
  if (eventType.includes('pick')) return { Icon: Box, tone: 'progress' }
  if (eventType.includes('cod') || eventType.includes('collected')) return { Icon: Banknote, tone: 'pending' }
  if (eventType.includes('deliver') || eventType.includes('ship')) return { Icon: Truck, tone: 'transit' }
  if (eventType.includes('cancel') || eventType.includes('reject')) return { Icon: X, tone: 'danger' }
  if (eventType.includes('created')) return { Icon: Plus, tone: 'success' }
  return { Icon: Bell, tone: 'neutral' }
}

type RecentRow = NonNullable<OmsDashboardSummary['recentOrders']>[number]

export function OmsDashboardPage() {
  const navigate = useNavigate()
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const [draft, setDraft] = useState<SummaryDraft>(defaultSummaryFilters)
  const [applied, setApplied] = useState<SummaryDraft>(defaultSummaryFilters)

  const defaults = defaultSummaryFilters()
  const isDefault =
    JSON.stringify(applied) === JSON.stringify(defaults) && JSON.stringify(draft) === JSON.stringify(defaults)
  const dirty = JSON.stringify(draft) !== JSON.stringify(applied)

  const summaryParams = useMemo(
    () => ({
      createdFrom: applied.createdFrom || undefined,
      createdTo: applied.createdTo || undefined,
      companyId: applied.companyId.trim() || undefined,
    }),
    [applied],
  )

  const dash = useQuery({ queryKey: QK.omsDashboard, queryFn: () => OmsApi.dashboard() })
  const companiesQuery = useQuery({ queryKey: QK.companies, queryFn: () => CompaniesApi.list() })
  const orderSummaryQuery = useQuery({
    queryKey: QK.omsOrderSummary(summaryParams),
    queryFn: () => OmsApi.orderSummary(summaryParams),
  })

  const d = dash.data
  const trends = d?.trends
  const currency = 'USD'

  const fmt = (n: number) => formatNumber(n, locale)
  const money = (value: string | number | null | undefined, cur = currency) =>
    formatCurrency(parseAmount(value), locale, cur.length === 3 ? cur : currency)

  const trendLabel = t('vs yesterday', 'مقارنة بالأمس')

  const statusDonut = useMemo(() => {
    const rows = aggregateCommercialStatusCounts(d?.ordersByStatus ?? [])
    return rows
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)
      .map((r) => {
        const tone = omsStatusTone(r.status)
        return {
          key: r.status,
          label: omsCommercialStatusLabel(r.status, isArabic),
          value: r.count,
          color: `var(--tone-${tone}-dot)`,
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.ordersByStatus, isArabic])

  const donutTotal = statusDonut.reduce((s, x) => s + x.value, 0)

  const orderSummary = useMemo(() => {
    const rows = orderSummaryQuery.data?.ordersByStatus ?? []
    const waiting = sumBucket(rows, WAITING)
    const processing = sumBucket(rows, PENDING_FULFILLMENT)
    const out = sumBucket(rows, OUT_FOR_DELIVERY)
    const delivered = sumBucket(rows, DELIVERED)
    const returned = sumBucket(rows, RETURNED)
    const cancelled = sumBucket(rows, CANCELLED_OR_FAILED)
    const total = orderSummaryQuery.data?.total ?? waiting + processing + out + delivered + returned + cancelled
    return { total, waiting, processing, out, delivered, returned, cancelled }
  }, [orderSummaryQuery.data])

  const trendChartData = useMemo(
    () =>
      (d?.ordersPerDay ?? []).map((row) => ({
        day: row.day,
        label: row.day.slice(5),
        count: row.count,
        revenue: parseAmount(row.revenue),
      })),
    [d?.ordersPerDay],
  )

  const recentColumns = useMemo<ColumnDef<RecentRow>[]>(
    () => [
      {
        id: 'order',
        header: t('Order', 'الطلب'),
        cell: ({ row }) => (
          <span className="font-mono text-sm font-semibold text-primary">{row.original.orderNumber}</span>
        ),
        meta: { priority: 1, className: 'min-w-32' },
      },
      {
        id: 'customer',
        header: t('Customer', 'العميل'),
        cell: ({ row }) => row.original.recipientName ?? row.original.companyName ?? '—',
        meta: { priority: 1, className: 'min-w-36' },
      },
      {
        id: 'status',
        header: t('Status', 'الحالة'),
        cell: ({ row }) => <OmsStatusBadge status={row.original.status} isArabic={isArabic} />,
        meta: { priority: 1, className: 'min-w-44' },
      },
      {
        id: 'payment',
        header: t('Payment', 'الدفع'),
        cell: ({ row }) => {
          const method = row.original.paymentMethod
          if (!method) return '—'
          const online = method === 'PREPAID' || method === 'CREDIT'
          return (
            <StatusBadge tone={online ? 'success' : 'warning'}>
              {online ? t('Online', 'عبر الإنترنت') : method}
            </StatusBadge>
          )
        },
        meta: { priority: 2, className: 'min-w-28' },
      },
      {
        id: 'cod',
        header: t('COD', 'الدفع عند الاستلام'),
        cell: ({ row }) =>
          row.original.codAmount
            ? money(row.original.codAmount, row.original.currency ?? currency)
            : '—',
        meta: { priority: 2, align: 'end', className: 'min-w-28 tabular' },
      },
      {
        id: 'date',
        header: t('Date', 'التاريخ'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{formatDateTime(row.original.createdAt, locale)}</span>
        ),
        meta: { priority: 2, align: 'end', className: 'min-w-36' },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isArabic, locale],
  )

  function refetchAll() {
    void dash.refetch()
    void orderSummaryQuery.refetch()
  }

  function applyPresetToDraft(preset: Exclude<DateRangePreset, 'custom'>) {
    const { from, to } = datesForPreset(preset)
    setDraft((prev) => ({ ...prev, preset, createdFrom: from, createdTo: to }))
  }

  const headerActions = (
    <>
      <Button asChild>
        <Link to="/orders/oms/new">
          <Plus aria-hidden />
          {t('New order', 'طلب جديد')}
        </Link>
      </Button>
      <Button variant="outline" asChild>
        <Link to="/orders/oms">{t('View orders', 'عرض الطلبات')}</Link>
      </Button>
      <Button variant="outline" size="icon" onClick={refetchAll} aria-label={t('Refresh', 'تحديث')} title={t('Refresh', 'تحديث')}>
        <RefreshCw className={dash.isFetching || orderSummaryQuery.isFetching ? 'animate-spin' : undefined} aria-hidden />
      </Button>
    </>
  )

  if (dash.isPending && !d) {
    return (
      <div className="space-y-5">
        <PageHeader
          title={t('OMS Dashboard', 'لوحة OMS')}
          description={t('E-commerce order pipeline and COD snapshot.', 'خط أنابيب طلبات التجارة الإلكترونية ولقطة الدفع عند الاستلام.')}
          actions={headerActions}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    )
  }

  if (dash.isError || !d) {
    return (
      <div className="space-y-5">
        <PageHeader
          title={t('OMS Dashboard', 'لوحة OMS')}
          description={t('E-commerce order pipeline and COD snapshot.', 'خط أنابيب طلبات التجارة الإلكترونية ولقطة الدفع عند الاستلام.')}
          actions={headerActions}
        />
        <div className="rounded-xl border bg-card">
          <ErrorState
            title={t('Could not load OMS dashboard', 'تعذر تحميل لوحة OMS')}
            retryLabel={t('Try again', 'إعادة المحاولة')}
            onRetry={() => void dash.refetch()}
          />
        </div>
      </div>
    )
  }

  const pendingApproval = d.pendingApproval ?? d.pendingOrders
  const codPendingDisplay = d.codPendingAmount ?? d.codPending

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('OMS Dashboard', 'لوحة OMS')}
        description={t('E-commerce order pipeline and COD snapshot.', 'خط أنابيب طلبات التجارة الإلكترونية ولقطة الدفع عند الاستلام.')}
        actions={headerActions}
      />

      <KpiStrip cols={4}>
        <KpiCard
          title={t("Today's orders", 'طلبات اليوم')}
          value={fmt(d.ordersToday)}
          icon={ShoppingCart}
          href="/orders/oms"
          footer={<Delta value={trends?.ordersToday} label={trendLabel} />}
        />
        <KpiCard
          title={t('Waiting for approval', 'بانتظار الموافقة')}
          value={fmt(pendingApproval)}
          icon={Clock}
          href="/orders/oms"
          footer={<Delta value={trends?.pendingApproval} label={trendLabel} />}
        />
        <KpiCard
          title={t('Out for delivery', 'خارج للتسليم')}
          value={fmt(d.outForDelivery)}
          icon={Truck}
          href="/orders/oms"
          footer={t('In transit to customers', 'في الطريق إلى العملاء')}
        />
        <KpiCard
          title={t('Delivered today', 'تم التسليم اليوم')}
          value={fmt(d.deliveredToday)}
          icon={CircleCheck}
          href="/orders/oms"
          footer={<Delta value={trends?.deliveredToday} label={trendLabel} />}
        />
        <KpiCard
          title={t("Today's revenue", 'إيرادات اليوم')}
          value={money(d.todaysRevenue)}
          icon={DollarSign}
          footer={<Delta value={trends?.todaysRevenue} label={trendLabel} />}
        />
        <KpiCard
          title={t('COD pending', 'COD بانتظار التحصيل')}
          value={money(codPendingDisplay)}
          icon={Wallet}
          href="/oms/cod"
          footer={t('Awaiting collection', 'بانتظار التحصيل')}
        />
      </KpiStrip>

      <div className="grid gap-4 xl:grid-cols-12">
        <Widget
          className="xl:col-span-4"
          title={t('Orders by status', 'الطلبات حسب الحالة')}
        >
          {statusDonut.length === 0 ? (
            <WidgetEmpty>{t('No data yet.', 'لا توجد بيانات بعد.')}</WidgetEmpty>
          ) : (
            <div className="space-y-4">
              <DonutChart
                data={statusDonut}
                size={176}
                centerValue={fmt(donutTotal)}
                centerLabel={t('Total', 'الإجمالي')}
              />
              <LegendList
                items={statusDonut.map((sl) => ({
                  key: sl.key,
                  label: sl.label,
                  value: fmt(sl.value),
                  color: sl.color,
                }))}
              />
            </div>
          )}
        </Widget>

        <Widget
          className="xl:col-span-8"
          title={t('Order summary', 'ملخص الطلبات')}
          action={<span className="text-sm text-muted-foreground">{t('Where are my orders?', 'أين طلباتي؟')}</span>}
          contentClassName="space-y-4"
        >
          <FilterBar className="flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="oms-sum-range" className="text-sm text-muted-foreground">
                {t('Range', 'الفترة')}
              </Label>
              <Select
                value={draft.preset}
                onValueChange={(v) => {
                  const preset = v as DateRangePreset
                  if (preset === 'custom') {
                    setDraft((prev) => ({ ...prev, preset: 'custom' }))
                    return
                  }
                  applyPresetToDraft(preset)
                }}
              >
                <SelectTrigger id="oms-sum-range" className="h-10 w-44 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this_month">{t('This month', 'هذا الشهر')}</SelectItem>
                  <SelectItem value="last_7_days">{t('Last 7 days', 'آخر 7 أيام')}</SelectItem>
                  <SelectItem value="last_month">{t('Last month', 'الشهر الماضي')}</SelectItem>
                  {draft.preset === 'custom' ? (
                    <SelectItem value="custom">{t('Custom', 'مخصص')}</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="oms-sum-from" className="text-sm text-muted-foreground">
                {t('Date from', 'من تاريخ')}
              </Label>
              <Input
                id="oms-sum-from"
                type="date"
                value={draft.createdFrom}
                onChange={(e) => setDraft((prev) => ({ ...prev, preset: 'custom', createdFrom: e.target.value }))}
                className="h-10 w-40 bg-card"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="oms-sum-to" className="text-sm text-muted-foreground">
                {t('Date to', 'إلى تاريخ')}
              </Label>
              <Input
                id="oms-sum-to"
                type="date"
                value={draft.createdTo}
                onChange={(e) => setDraft((prev) => ({ ...prev, preset: 'custom', createdTo: e.target.value }))}
                className="h-10 w-40 bg-card"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="oms-sum-client" className="text-sm text-muted-foreground">
                {t('Client', 'العميل')}
              </Label>
              <Select
                value={draft.companyId || ALL}
                onValueChange={(v) => setDraft((prev) => ({ ...prev, companyId: v === ALL ? '' : v }))}
              >
                <SelectTrigger id="oms-sum-client" className="h-10 min-w-44 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t('All clients', 'جميع العملاء')}</SelectItem>
                  {(companiesQuery.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.tradeName?.trim() || c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="secondary" disabled={!dirty} onClick={() => setApplied({ ...draft })}>
              {t('Apply', 'تطبيق')}
            </Button>
            <ResetFiltersButton
              label={t('Reset', 'إعادة تعيين')}
              disabled={isDefault}
              onClick={() => {
                const next = defaultSummaryFilters()
                setDraft(next)
                setApplied(next)
              }}
            />
          </FilterBar>

          {orderSummaryQuery.isError ? (
            <WidgetError
              message={t('Could not load order summary', 'تعذر تحميل ملخص الطلبات')}
              retryLabel={t('Try again', 'إعادة المحاولة')}
              onRetry={() => void orderSummaryQuery.refetch()}
            />
          ) : orderSummaryQuery.isPending ? (
            <Skeleton className="h-28 rounded-xl" />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <SummaryTile
                className="col-span-full sm:col-span-2 lg:col-span-4"
                label={t('Total orders', 'إجمالي الطلبات')}
                count={orderSummary.total}
                total={orderSummary.total}
                tone={null}
                locale={locale}
              />
              <SummaryTile
                label={t('Waiting', 'بانتظار')}
                count={orderSummary.waiting}
                total={orderSummary.total || 1}
                tone="pending"
                locale={locale}
              />
              <SummaryTile
                label={t('Processing', 'قيد المعالجة')}
                count={orderSummary.processing}
                total={orderSummary.total || 1}
                tone="progress"
                locale={locale}
              />
              <SummaryTile
                label={t('Out for delivery', 'خارج للتسليم')}
                count={orderSummary.out}
                total={orderSummary.total || 1}
                tone="transit"
                locale={locale}
              />
              <SummaryTile
                label={t('Delivered', 'تم التسليم')}
                count={orderSummary.delivered}
                total={orderSummary.total || 1}
                tone="success"
                locale={locale}
              />
              <SummaryTile
                label={t('Returned', 'مرتجع')}
                count={orderSummary.returned}
                total={orderSummary.total || 1}
                tone="returned"
                locale={locale}
              />
              <SummaryTile
                label={t('Cancelled / failed', 'ملغي / فشل')}
                count={orderSummary.cancelled}
                total={orderSummary.total || 1}
                tone="neutral"
                locale={locale}
              />
            </div>
          )}
        </Widget>
      </div>

      <Widget
        title={t('Orders trend', 'اتجاه الطلبات')}
        action={
          <span className="text-sm text-muted-foreground">
            {t('Last 7 days · hover for values', 'آخر 7 أيام · مرّر للقيم')}
          </span>
        }
      >
        {trendChartData.length === 0 ? (
          <WidgetEmpty>{t('No trend data yet.', 'لا توجد بيانات اتجاه بعد.')}</WidgetEmpty>
        ) : (
          <LineSeriesChart
            data={trendChartData}
            xKey="label"
            height={240}
            yFormatter={(v) => fmt(v)}
            series={[
              { key: 'count', label: t('Orders', 'الطلبات'), color: 'var(--chart-1)' },
              { key: 'revenue', label: t('Revenue', 'الإيرادات'), color: 'var(--chart-2)' },
            ]}
          />
        )}
      </Widget>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Widget
          title={t('Recent orders', 'الطلبات الأخيرة')}
          action={<WidgetLink to="/orders/oms">{t('View all', 'عرض الكل')}</WidgetLink>}
        >
          <DataTable
            columns={recentColumns}
            data={d.recentOrders ?? []}
            getRowId={(row) => row.id}
            empty={t('No recent orders.', 'لا توجد طلبات حديثة.')}
            labels={{ noResults: t('No recent orders.', 'لا توجد طلبات حديثة.') }}
            onRowClick={(row) => navigate(`/orders/oms/${row.id}`)}
          />
        </Widget>

        <Widget title={t('Live activity', 'النشاط المباشر')} action={<WidgetLink to="/orders/oms">{t('View all', 'عرض الكل')}</WidgetLink>}>
          {(d.liveActivity ?? []).length === 0 ? (
            <WidgetEmpty>{t('No recent events.', 'لا توجد أحداث حديثة.')}</WidgetEmpty>
          ) : (
            <ul className="max-h-[28rem] space-y-3 overflow-y-auto pe-1">
              {(d.liveActivity ?? []).slice(0, 12).map((ev) => {
                const { Icon, tone } = eventVisual(ev.eventType)
                const tc = toneClasses[tone]
                const label = eventLabel(ev, isArabic)
                return (
                  <li key={ev.id} className="flex gap-2.5 text-sm">
                    <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-full', tc.bg, tc.text)}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      {ev.orderId ? (
                        <Link to={`/orders/oms/${ev.orderId}`} className="font-medium text-foreground hover:text-primary hover:underline">
                          {label}
                        </Link>
                      ) : (
                        <span className="font-medium text-foreground">{label}</span>
                      )}
                      <div className="text-xs text-muted-foreground">{formatRelative(ev.createdAt, locale)}</div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Widget>
      </div>
    </div>
  )
}
