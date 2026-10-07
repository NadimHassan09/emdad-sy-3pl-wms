import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Bell, Boxes, ClipboardList, DollarSign, Download, RefreshCw, ShoppingCart, Users } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { Delta, KpiCard, KpiStrip, Sparkline, WelcomeBanner, ConfirmDialog, ErrorState } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { BillingApi } from '@/api/billing'
import { CompaniesApi } from '@/api/companies'
import { DashboardApi } from '@/api/dashboard'
import { InboundApi } from '@/api/inbound'
import { InventoryApi } from '@/api/inventory'
import { OutboundApi } from '@/api/outbound'
import { useAuth } from '@/auth/AuthContext'
import { QK } from '@/constants/query-keys'
import { useNotifications } from '@/hooks/useNotifications'
import { useDefaultWarehouseId } from '@/hooks/useDefaultWarehouse'
import { formatDecimal } from '@/lib/billing-invoice-display'
import { canAccessPath } from '@/lib/rbac'
import { dashboardLabel } from './dashboard-i18n'
import { binByDay, cbmNumber, downloadCsv, firstName, greetingForHour, lastUpdatedLabel, numberFmt, percentFmt, periodDelta, periodStart, toYmd, type PeriodKey } from './dashboard-utils'
import {
  BillingClientsWidget,
  NeedsAttentionWidget,
  OperationsOverviewWidget,
  OutboundPipelineWidget,
  QuickActionsWidget,
  RecentActivityWidget,
  StorageWidget,
  TopProductsWidget,
  WarehouseTasksWidget,
  type ActivityItem,
  type AttentionItem,
  type OpsPoint,
  type PipelineStage,
  type TopProductRow,
} from './widgets'

type Filters = { warehouseId: string; companyId: string; period: PeriodKey }
const ALL = '__all__'

type Pending = { kind: 'renew'; planId: string; name: string } | { kind: 'restore'; companyId: string; name: string } | null

export function DashboardOverviewPage() {
  const { isArabic } = useUiPreferences()
  const t = (label: string) => dashboardLabel(label, isArabic)
  const { user } = useAuth()
  const qc = useQueryClient()
  const { unreadCount } = useNotifications()
  const { warehouses } = useDefaultWarehouseId()

  const canSeeBilling = user?.role === 'super_admin' || user?.role === 'wh_manager' || user?.role === 'finance'
  const canMutate = user?.role === 'super_admin' || user?.role === 'wh_manager'
  const canClients = canAccessPath(user?.role, '/clients')
  const canBilling = canAccessPath(user?.role, '/billing/plans')
  const canProducts = canAccessPath(user?.role, '/products')
  const canWarehouses = canAccessPath(user?.role, '/warehouses')
  const canTasks = canAccessPath(user?.role, '/tasks')

  const [filters, setFilters] = useState<Filters>({ warehouseId: '', companyId: '', period: '30' })
  const [pending, setPending] = useState<Pending>(null)

  const from = useMemo(() => periodStart(filters.period), [filters.period])
  const fromYmd = toYmd(from)
  const seriesParams = useMemo(
    () => ({ warehouseId: filters.warehouseId || undefined, companyId: filters.companyId || undefined, createdFrom: fromYmd, limit: 200 }),
    [filters.warehouseId, filters.companyId, fromYmd],
  )

  const overview = useQuery({ queryKey: QK.dashboardOverview, queryFn: () => DashboardApi.overview() })
  const charts = useQuery({ queryKey: QK.dashboardOpenOrdersCharts, queryFn: () => DashboardApi.openOrdersCharts() })
  const companiesQuery = useQuery({ queryKey: QK.companies, queryFn: () => CompaniesApi.list({ includeAll: true }) })
  const billingSummary = useQuery({ queryKey: QK.billing.dashboardSummary, queryFn: () => BillingApi.getDashboardSummary(), enabled: canSeeBilling })
  const expiringQuery = useQuery({ queryKey: QK.billing.expiringSoon, queryFn: () => BillingApi.listExpiringSoon(5), enabled: canSeeBilling })
  const overdueQuery = useQuery({ queryKey: QK.billing.overdueClients, queryFn: () => BillingApi.listOverdueClients(5), enabled: canSeeBilling })
  const invoicesQuery = useQuery({ queryKey: QK.billing.recentInvoices, queryFn: () => BillingApi.listRecentInvoices(5), enabled: canSeeBilling })
  const suspendedQuery = useQuery({ queryKey: QK.billing.suspendedAccounts, queryFn: () => BillingApi.listSuspendedAccounts(5), enabled: canSeeBilling })
  const inboundSeries = useQuery({ queryKey: QK.dashboardOrderSeries({ side: 'inbound', ...seriesParams }), queryFn: () => InboundApi.list(seriesParams), staleTime: 30_000 })
  const outboundSeries = useQuery({ queryKey: QK.dashboardOrderSeries({ side: 'outbound', ...seriesParams }), queryFn: () => OutboundApi.list(seriesParams), staleTime: 30_000 })
  const ledgerQuery = useQuery({
    queryKey: QK.dashboardTopProducts(seriesParams),
    queryFn: () => InventoryApi.ledger({ warehouseId: seriesParams.warehouseId, companyId: seriesParams.companyId, createdFrom: seriesParams.createdFrom, limit: 100 }),
    staleTime: 30_000,
  })

  const renewMut = useMutation({
    mutationFn: (planId: string) => BillingApi.renewPlan(planId),
    onSuccess: () => {
      toast.success(t('Billing plan renewed. Access restored and a new cycle started.'))
      for (const key of [QK.billing.overdueClients, QK.billing.suspendedAccounts, QK.billing.plans, QK.billing.cycles, QK.companies]) void qc.invalidateQueries({ queryKey: key })
      setPending(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })
  const restoreMut = useMutation({
    mutationFn: (companyId: string) => CompaniesApi.restore(companyId),
    onSuccess: () => {
      toast.success(t('Client account restored.'))
      void qc.invalidateQueries({ queryKey: QK.billing.suspendedAccounts })
      void qc.invalidateQueries({ queryKey: QK.companies })
      setPending(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const data = overview.data
  const companies = companiesQuery.data ?? []
  const now = new Date()

  const opsPoints: OpsPoint[] = useMemo(() => {
    const inb = binByDay(inboundSeries.data?.items ?? [], from, now)
    const out = binByDay(outboundSeries.data?.items ?? [], from, now)
    return inb.map((b, i) => ({ date: b.date, label: b.label, inbound: b.count, outbound: out[i]?.count ?? 0 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inboundSeries.data?.items, outboundSeries.data?.items, from])

  const taskChartPoints: OpsPoint[] = useMemo(
    () => (data?.openTasksByType ?? []).map((row) => ({ date: row.key, label: t(row.label), tasks: row.openCount })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data?.openTasksByType, isArabic],
  )

  const orderSpark = useMemo(() => opsPoints.map((p) => (p.inbound ?? 0) + (p.outbound ?? 0)), [opsPoints])
  const orderTrend = useMemo(() => {
    if (opsPoints.length < 14) return null
    const sum = (a: OpsPoint[]) => a.reduce((s, p) => s + (p.inbound ?? 0) + (p.outbound ?? 0), 0)
    return periodDelta(sum(opsPoints.slice(-7)), sum(opsPoints.slice(-14, -7)))
  }, [opsPoints])

  const openOrderCount = (data?.openOrders.inbound ?? 0) + (data?.openOrders.outbound ?? 0)
  const pendingOrders = (charts.data?.inbound.notInProgress ?? 0) + (charts.data?.outbound.notInProgress ?? 0)
  const inProgressOrders = (charts.data?.inbound.inProgress ?? 0) + (charts.data?.outbound.inProgress ?? 0)
  const readyOrders = charts.data?.outbound.stages.find((s) => s.key === 'shipping')?.count ?? 0
  const pendingTaskCount = (data?.openTasksByType ?? []).reduce((s, r) => s + r.openCount, 0)
  const inProgressTasks = (data?.openTasksByType ?? []).reduce((s, r) => s + r.inProgressCount, 0)
  const notStartedTasks = Math.max(0, pendingTaskCount - inProgressTasks)
  const activeClients = companies.filter((c) => c.status === 'active').length
  const suspendedClients = companies.filter((c) => c.status === 'suspended' || c.status === 'restricted').length

  const pipelineStages: PipelineStage[] = useMemo(() => {
    const st = (k: string) => charts.data?.outbound.stages.find((s) => s.key === k)?.count ?? 0
    return [
      { key: 'pending', label: 'Pending', count: charts.data?.outbound.notInProgress ?? 0, to: '/orders/outbound?status=confirmed', tone: 'pending' },
      { key: 'picking', label: 'Picking', count: st('picking'), to: '/orders/outbound?status=picking', tone: 'progress' },
      { key: 'packing', label: 'Packing', count: st('packing'), to: '/orders/outbound?status=packing', tone: 'transit' },
      { key: 'ready', label: 'Ready', count: st('shipping'), to: '/orders/outbound?status=ready_to_ship', tone: 'success' },
    ]
  }, [charts.data])

  const attentionItems: AttentionItem[] = useMemo(() => {
    const items: AttentionItem[] = []
    for (const row of suspendedQuery.data ?? []) {
      items.push({
        id: `sus-${row.companyId}`,
        severity: 'critical',
        title: row.companyName,
        description: `${t('Account suspended')} · ${row.suspendedSince ? new Date(row.suspendedSince).toLocaleDateString() : ''}`,
        actionLabel: t('Restore'),
        to: `/billing/plans/${row.companyId}`,
        onAction: canMutate
          ? () => setPending(row.billingPlanId ? { kind: 'renew', planId: row.billingPlanId, name: row.companyName } : { kind: 'restore', companyId: row.companyId, name: row.companyName })
          : undefined,
      })
    }
    const pickingCount = pipelineStages.find((s) => s.key === 'picking')?.count ?? 0
    if (pickingCount > 0) items.push({ id: 'picking', severity: 'warning', title: `${pickingCount} ${t('outbound orders')}`, description: t('Waiting for picking'), actionLabel: t('View Orders'), to: '/orders/outbound?status=picking' })
    const expiringLots = (data?.soonExpiryLots ?? []).filter((lot) => !lot.expiryDate || (new Date(lot.expiryDate).getTime() - Date.now()) / 86_400_000 <= 30)
    if (expiringLots.length > 0) items.push({ id: 'expiry', severity: 'warning', title: `${expiringLots.length} ${t('products')}`, description: t('Expiring within 30 days'), actionLabel: t('Review'), to: '/inventory/stock' })
    const endingSoon = (expiringQuery.data ?? []).filter((r) => r.daysRemaining <= 1)
    if (endingSoon[0]) items.push({ id: `cycle-${endingSoon[0].id}`, severity: 'warning', title: `1 ${t('billing cycle')}`, description: endingSoon[0].daysRemaining <= 0 ? t('Ending soon') : t('Ending tomorrow'), actionLabel: t('Review Billing'), to: `/billing/plans/${endingSoon[0].companyId}` })
    return items.slice(0, 4)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suspendedQuery.data, pipelineStages, data?.soonExpiryLots, expiringQuery.data, canMutate, isArabic])

  const activityItems: ActivityItem[] = useMemo(() => {
    const selectedName = companies.find((c) => c.id === filters.companyId)?.name
    const keep = (name: string) => !filters.companyId || name === selectedName
    const inbound: ActivityItem[] = (data?.recentOrders.inbound ?? []).filter((o) => keep(o.companyName)).map((o) => ({ id: `in-${o.id}`, title: `${t('Inbound order')} ${o.orderNumber}`, subtitle: o.companyName, at: o.createdAt, to: `/orders/inbound/${o.id}`, tone: 'progress', icon: 'inbound' }))
    const outbound: ActivityItem[] = (data?.recentOrders.outbound ?? []).filter((o) => keep(o.companyName)).map((o) => ({ id: `out-${o.id}`, title: `${t('Outbound order')} ${o.orderNumber}`, subtitle: o.companyName, at: o.createdAt, to: `/orders/outbound/${o.id}`, tone: 'success', icon: 'outbound' }))
    const invoices: ActivityItem[] = (invoicesQuery.data ?? []).map((r) => ({ id: `inv-${r.id}`, title: r.invoiceNumber, subtitle: r.companyName, at: r.createdAt, to: `/billing/invoices/${r.id}`, tone: r.status === 'paid' ? 'success' : 'pending', icon: 'invoice' }))
    const suspended: ActivityItem[] = (suspendedQuery.data ?? []).map((r) => ({ id: `act-sus-${r.companyId}`, title: `${r.companyName} — ${t('Account suspended')}`, at: r.suspendedSince, to: `/billing/plans/${r.companyId}`, tone: 'danger', icon: 'client' }))
    return [...inbound, ...outbound, ...invoices, ...suspended].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 6)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.recentOrders, invoicesQuery.data, suspendedQuery.data, filters.companyId, companies, isArabic])

  const topProducts: TopProductRow[] = useMemo(() => {
    const counts = new Map<string, TopProductRow>()
    for (const row of ledgerQuery.data?.items ?? []) {
      const cur = counts.get(row.productId)
      if (cur) cur.moves += 1
      else counts.set(row.productId, { productId: row.productId, name: row.product?.name ?? row.productId, sku: row.product?.sku, moves: 1 })
    }
    return Array.from(counts.values()).sort((a, b) => b.moves - a.moves).slice(0, 5)
  }, [ledgerQuery.data?.items])

  function refetchAll() {
    void overview.refetch(); void charts.refetch(); void inboundSeries.refetch(); void outboundSeries.refetch(); void ledgerQuery.refetch()
    if (canSeeBilling) { void billingSummary.refetch(); void expiringQuery.refetch(); void overdueQuery.refetch(); void invoicesQuery.refetch(); void suspendedQuery.refetch() }
  }

  function handleExport() {
    downloadCsv(`emdad-dashboard-${toYmd(new Date())}.csv`, [
      { metric: 'Open orders', value: openOrderCount },
      { metric: 'Pending tasks', value: pendingTaskCount },
      { metric: 'Storage utilization %', value: data?.capacity.storageUsagePercent ?? 0 },
      { metric: 'Active clients', value: activeClients },
      { metric: 'Revenue this month', value: billingSummary.data?.currentMonthRevenue ?? '' },
    ])
    toast.success(t('Dashboard exported.'))
  }

  const updatedAt = overview.dataUpdatedAt ? new Date(overview.dataUpdatedAt) : null
  const showSkeleton = overview.isPending && !data
  const breakdown = (rows: { label: string; value: string | number }[]) => (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5">
      {rows.map((r) => (
        <span key={r.label} className="whitespace-nowrap">
          {r.label} <b className="tabular font-semibold text-foreground">{r.value}</b>
        </span>
      ))}
    </span>
  )

  return (
    <div className="space-y-5">
      <WelcomeBanner
        title={`${t(greetingForHour(new Date().getHours()))}, ${firstName(user?.fullName, t('Admin'))}`}
        subtitle={
          <>
            {t("Here's what's happening across your warehouse operations.")}
            {updatedAt ? <span className="mt-1 block text-xs text-muted-foreground">{t('Last updated')} {lastUpdatedLabel(updatedAt, isArabic)}</span> : null}
          </>
        }
        actions={
          <>
            <Button variant="outline" size="icon" onClick={refetchAll} aria-label={t('Refresh')} title={t('Refresh')}>
              <RefreshCw className={overview.isFetching ? 'animate-spin' : undefined} aria-hidden />
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download aria-hidden />
              {t('Export')}
            </Button>
            <Button variant="outline" size="icon" asChild className="relative" title={t('Notifications')}>
              <Link to="/notifications" aria-label={t('Notifications')}>
                <Bell aria-hidden />
                {unreadCount > 0 ? <span className="absolute -end-1 -top-1 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-xs font-semibold leading-5 text-destructive-foreground">{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect label={t('Warehouse')} value={filters.warehouseId} allLabel={t('All Warehouses')} onChange={(v) => setFilters((f) => ({ ...f, warehouseId: v }))} options={warehouses.map((w) => ({ value: w.id, label: w.name }))} />
        <FilterSelect label={t('Client')} value={filters.companyId} allLabel={t('All Clients')} onChange={(v) => setFilters((f) => ({ ...f, companyId: v }))} options={companies.map((c) => ({ value: c.id, label: c.tradeName?.trim() || c.name }))} />
        <FilterSelect label={t('Period')} value={filters.period} onChange={(v) => setFilters((f) => ({ ...f, period: v as PeriodKey }))} options={[{ value: '7', label: t('Last 7 days') }, { value: '30', label: t('Last 30 days') }, { value: '90', label: t('Last 90 days') }]} />
      </div>

      {overview.isError && !data ? (
        <div className="rounded-xl border bg-card">
          <ErrorState title={t('Could not load dashboard')} retryLabel={t('Try again')} onRetry={() => overview.refetch()} />
        </div>
      ) : null}

      {showSkeleton ? (
        <DashboardSkeleton />
      ) : (
        <>
          <KpiStrip cols={5}>
            <KpiCard
              title={t('Open Orders')}
              value={numberFmt(openOrderCount)}
              icon={ShoppingCart}
              href="/orders/outbound"
              footer={
                <div className="space-y-1">
                  {orderTrend != null ? <Delta value={orderTrend} label={t('vs last week')} /> : null}
                  {breakdown([{ label: t('Pending'), value: pendingOrders }, { label: t('In Progress'), value: inProgressOrders }, { label: t('Ready'), value: readyOrders }])}
                </div>
              }
              visual={orderSpark.length > 1 ? <Sparkline values={orderSpark} /> : undefined}
            />
            <KpiCard title={t('Pending Tasks')} value={numberFmt(pendingTaskCount)} icon={ClipboardList} href={canTasks ? '/tasks' : undefined} footer={breakdown([{ label: t('In Progress'), value: inProgressTasks }, { label: t('Pending'), value: notStartedTasks }])} />
            <KpiCard
              title={t('Storage Utilization')}
              value={percentFmt(data?.capacity.storageUsagePercent ?? 0)}
              icon={Boxes}
              href="/billing/plans"
              footer={breakdown([{ label: `${t('CBM')} ${t('used')}`, value: `${cbmNumber(data?.capacity.usedStorageCbm).toFixed(0)} / ${cbmNumber(data?.capacity.reservedStorageCbm).toFixed(0)}` }])}
            />
            <KpiCard title={t('Active Clients')} value={numberFmt(activeClients || data?.counters.totalCustomers || 0)} icon={Users} href={canClients ? '/clients' : undefined} footer={suspendedClients > 0 ? breakdown([{ label: t('Suspended'), value: suspendedClients }]) : undefined} />
            <KpiCard
              title={t('Revenue (This Month)')}
              value={canSeeBilling ? `$${formatDecimal(billingSummary.data?.currentMonthRevenue ?? 0)}` : '—'}
              icon={DollarSign}
              href={canBilling ? '/billing/invoices' : undefined}
              footer={canSeeBilling ? breakdown([{ label: t('Invoices'), value: billingSummary.data?.openInvoiceCount ?? 0 }]) : undefined}
            />
          </KpiStrip>

          <div className="grid gap-4 xl:grid-cols-12">
            <div className="min-w-0 xl:col-span-6">
              <OperationsOverviewWidget
                data={opsPoints}
                taskData={taskChartPoints}
                period={filters.period}
                onPeriodChange={(period) => setFilters((f) => ({ ...f, period }))}
                isArabic={isArabic}
                isLoading={inboundSeries.isPending || outboundSeries.isPending}
                isError={inboundSeries.isError || outboundSeries.isError}
                onRetry={() => { void inboundSeries.refetch(); void outboundSeries.refetch() }}
              />
            </div>
            <div className="min-w-0 xl:col-span-3">
              <NeedsAttentionWidget items={attentionItems} isArabic={isArabic} busy={renewMut.isPending || restoreMut.isPending} />
            </div>
            <div className="min-w-0 xl:col-span-3">
              <QuickActionsWidget isArabic={isArabic} canClients={canClients} canBilling={canBilling} canProducts={canProducts} canWarehouses={canWarehouses} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <OutboundPipelineWidget stages={pipelineStages} isArabic={isArabic} />
            <WarehouseTasksWidget rows={data?.openTasksByType ?? []} isArabic={isArabic} canOpenTasks={canTasks} />
            <StorageWidget usedCbm={data?.capacity.usedStorageCbm ?? 0} reservedCbm={data?.capacity.reservedStorageCbm ?? 0} remainingCbm={data?.capacity.remainingStorageCbm ?? 0} percent={data?.capacity.storageUsagePercent ?? 0} warehouses={warehouses} canOpenWarehouses={canWarehouses} isArabic={isArabic} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {canSeeBilling ? (
              <BillingClientsWidget
                expiring={expiringQuery.data ?? []}
                overdue={overdueQuery.data ?? []}
                invoices={invoicesQuery.data ?? []}
                canMutate={canMutate}
                isArabic={isArabic}
                onResolveOverdue={(planId, name) => setPending({ kind: 'renew', planId, name })}
                renewPending={renewMut.isPending}
                isError={expiringQuery.isError || overdueQuery.isError || invoicesQuery.isError}
                onRetry={() => { void expiringQuery.refetch(); void overdueQuery.refetch(); void invoicesQuery.refetch() }}
              />
            ) : (
              <div className="hidden lg:block" />
            )}
            <RecentActivityWidget items={activityItems} isArabic={isArabic} />
            <TopProductsWidget rows={topProducts} isArabic={isArabic} isError={ledgerQuery.isError} onRetry={() => void ledgerQuery.refetch()} />
          </div>
        </>
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        intent="default"
        title={pending?.kind === 'renew' ? t('Renew billing plan?') : t('Restore client account?')}
        description={
          pending?.kind === 'renew'
            ? isArabic ? `تجديد خطة الفوترة لـ ${pending.name}؟ سيؤدي ذلك إلى استعادة الوصول وبدء دورة فوترة جديدة.` : `Renew billing plan for ${pending.name}? This restores access and starts a new billing cycle.`
            : pending ? (isArabic ? `استعادة حساب ${pending.name}؟` : `Restore the account of ${pending.name}?`) : undefined
        }
        confirmLabel={pending?.kind === 'renew' ? t('Renew') : t('Restore')}
        cancelLabel={isArabic ? 'إلغاء' : 'Cancel'}
        loading={renewMut.isPending || restoreMut.isPending}
        onConfirm={() => {
          if (pending?.kind === 'renew') renewMut.mutate(pending.planId)
          else if (pending?.kind === 'restore') restoreMut.mutate(pending.companyId)
        }}
      />
    </div>
  )
}

function FilterSelect({ label, value, allLabel, onChange, options }: { label: string; value: string; allLabel?: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <Select value={value === '' ? ALL : value} onValueChange={(v) => onChange(v === ALL ? '' : v)}>
      <SelectTrigger className="h-10 min-w-44 max-w-full bg-card" aria-label={label}>
        <span className="text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allLabel ? <SelectItem value={ALL}>{allLabel}</SelectItem> : null}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-12">
        <Skeleton className="h-80 rounded-xl xl:col-span-6" />
        <Skeleton className="h-80 rounded-xl xl:col-span-3" />
        <Skeleton className="h-80 rounded-xl xl:col-span-3" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
      </div>
    </div>
  )
}
