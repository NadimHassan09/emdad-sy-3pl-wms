/**
 * DashboardOverviewPage — premium operations command center.
 *
 * UI redesign only: reuses existing dashboard, billing, order, inventory,
 * and company APIs. No backend changes.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Boxes,
  ClipboardList,
  DollarSign,
  ShoppingCart,
  Users,
} from 'lucide-react';

import { BillingApi } from '../api/billing';
import { CompaniesApi } from '../api/companies';
import { DashboardApi } from '../api/dashboard';
import { InboundApi } from '../api/inbound';
import { InventoryApi } from '../api/inventory';
import { OutboundApi } from '../api/outbound';
import { useAuth } from '../auth/AuthContext';
import { BillingClients } from '../components/dashboard/BillingClients';
import { DashboardFilters, type DashboardFilterState } from '../components/dashboard/DashboardFilters';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { DashboardSkeleton } from '../components/dashboard/DashboardSkeleton';
import { dashboardLabel, useDashboardIsArabic } from '../components/dashboard/dashboard-i18n';
import {
  binByDay,
  cbmNumber,
  downloadCsv,
  numberFmt,
  percentFmt,
  periodDelta,
  periodStart,
  toYmd,
} from '../components/dashboard/dashboard-utils';
import { KPICard } from '../components/dashboard/KPICard';
import { NeedsAttention, type AttentionItem } from '../components/dashboard/NeedsAttention';
import { OperationsOverview, type OpsPoint } from '../components/dashboard/OperationsOverview';
import { OutboundPipeline, type PipelineStage } from '../components/dashboard/OutboundPipeline';
import { QuickActions } from '../components/dashboard/QuickActions';
import { RecentActivity, type ActivityItem } from '../components/dashboard/RecentActivity';
import { StorageUtilization } from '../components/dashboard/StorageUtilization';
import { TopProducts, type TopProductRow } from '../components/dashboard/TopProducts';
import { WarehouseTasks } from '../components/dashboard/WarehouseTasks';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { useNotifications } from '../hooks/useNotifications';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import { formatDecimal } from '../lib/billing-invoice-display';
import { canAccessPath } from '../lib/rbac';
import { Alert } from '@ds';

export function DashboardOverviewPage() {
  const isArabic = useDashboardIsArabic();
  const t = (label: string) => dashboardLabel(label, isArabic);
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const { unreadCount } = useNotifications();
  const { warehouses } = useDefaultWarehouseId();

  const canSeeBilling =
    user?.role === 'super_admin' || user?.role === 'wh_manager' || user?.role === 'finance';
  const canMutate = user?.role === 'super_admin' || user?.role === 'wh_manager';
  const canClients = canAccessPath(user?.role, '/clients');
  const canBilling = canAccessPath(user?.role, '/billing/plans');
  const canProducts = canAccessPath(user?.role, '/products');
  const canWarehouses = canAccessPath(user?.role, '/warehouses');
  const canTasks = canAccessPath(user?.role, '/tasks');

  const [filters, setFilters] = useState<DashboardFilterState>({
    warehouseId: '',
    companyId: '',
    period: '30',
  });

  const from = useMemo(() => periodStart(filters.period), [filters.period]);
  const fromYmd = toYmd(from);
  const seriesParams = useMemo(
    () => ({
      warehouseId: filters.warehouseId || undefined,
      companyId: filters.companyId || undefined,
      createdFrom: fromYmd,
      limit: 200,
    }),
    [filters.warehouseId, filters.companyId, fromYmd],
  );

  const overview = useQuery({
    queryKey: QK.dashboardOverview,
    queryFn: () => DashboardApi.overview(),
  });

  const charts = useQuery({
    queryKey: QK.dashboardOpenOrdersCharts,
    queryFn: () => DashboardApi.openOrdersCharts(),
  });

  const companiesQuery = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list({ includeAll: true }),
  });

  const billingSummary = useQuery({
    queryKey: QK.billing.dashboardSummary,
    queryFn: () => BillingApi.getDashboardSummary(),
    enabled: canSeeBilling,
  });

  const expiringQuery = useQuery({
    queryKey: QK.billing.expiringSoon,
    queryFn: () => BillingApi.listExpiringSoon(5),
    enabled: canSeeBilling,
  });

  const overdueQuery = useQuery({
    queryKey: QK.billing.overdueClients,
    queryFn: () => BillingApi.listOverdueClients(5),
    enabled: canSeeBilling,
  });

  const invoicesQuery = useQuery({
    queryKey: QK.billing.recentInvoices,
    queryFn: () => BillingApi.listRecentInvoices(5),
    enabled: canSeeBilling,
  });

  const suspendedQuery = useQuery({
    queryKey: QK.billing.suspendedAccounts,
    queryFn: () => BillingApi.listSuspendedAccounts(5),
    enabled: canSeeBilling,
  });

  const inboundSeries = useQuery({
    queryKey: QK.dashboardOrderSeries({ side: 'inbound', ...seriesParams }),
    queryFn: () => InboundApi.list(seriesParams),
    staleTime: 30_000,
  });

  const outboundSeries = useQuery({
    queryKey: QK.dashboardOrderSeries({ side: 'outbound', ...seriesParams }),
    queryFn: () => OutboundApi.list(seriesParams),
    staleTime: 30_000,
  });

  const ledgerQuery = useQuery({
    queryKey: QK.dashboardTopProducts(seriesParams),
    queryFn: () =>
      InventoryApi.ledger({
        warehouseId: seriesParams.warehouseId,
        companyId: seriesParams.companyId,
        createdFrom: seriesParams.createdFrom,
        limit: 100,
      }),
    staleTime: 30_000,
  });

  const renewMut = useMutation({
    mutationFn: (planId: string) => BillingApi.renewPlan(planId),
    onSuccess: () => {
      toast.success('Billing plan renewed. Access restored and a new cycle started.');
      void qc.invalidateQueries({ queryKey: QK.billing.overdueClients });
      void qc.invalidateQueries({ queryKey: QK.billing.suspendedAccounts });
      void qc.invalidateQueries({ queryKey: QK.billing.plans });
      void qc.invalidateQueries({ queryKey: QK.billing.cycles });
      void qc.invalidateQueries({ queryKey: QK.companies });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const restoreMut = useMutation({
    mutationFn: (companyId: string) => CompaniesApi.restore(companyId),
    onSuccess: () => {
      toast.success('Client account restored.');
      void qc.invalidateQueries({ queryKey: QK.billing.suspendedAccounts });
      void qc.invalidateQueries({ queryKey: QK.companies });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const data = overview.data;
  const companies = companiesQuery.data ?? [];
  const now = new Date();

  const opsPoints: OpsPoint[] = useMemo(() => {
    const inboundBins = binByDay(inboundSeries.data?.items ?? [], from, now);
    const outboundBins = binByDay(outboundSeries.data?.items ?? [], from, now);
    return inboundBins.map((b, i) => ({
      date: b.date,
      label: b.label,
      inbound: b.count,
      outbound: outboundBins[i]?.count ?? 0,
    }));
  }, [inboundSeries.data?.items, outboundSeries.data?.items, from]);

  const taskChartPoints: OpsPoint[] = useMemo(
    () =>
      (data?.openTasksByType ?? []).map((row) => ({
        date: row.key,
        label: t(row.label),
        tasks: row.openCount,
      })),
    [data?.openTasksByType, isArabic],
  );

  const orderSpark = useMemo(
    () => opsPoints.map((p) => ({ value: (p.inbound ?? 0) + (p.outbound ?? 0) })),
    [opsPoints],
  );

  const orderTrend = useMemo(() => {
    if (opsPoints.length < 14) return null;
    const last7 = opsPoints.slice(-7).reduce((s, p) => s + (p.inbound ?? 0) + (p.outbound ?? 0), 0);
    const prev7 = opsPoints.slice(-14, -7).reduce((s, p) => s + (p.inbound ?? 0) + (p.outbound ?? 0), 0);
    const delta = periodDelta(last7, prev7);
    if (delta == null) return null;
    return { value: delta, label: t('vs last week') };
  }, [opsPoints, isArabic]);

  const openOrderCount = (data?.openOrders.inbound ?? 0) + (data?.openOrders.outbound ?? 0);
  const pendingOrders =
    (charts.data?.inbound.notInProgress ?? 0) + (charts.data?.outbound.notInProgress ?? 0);
  const inProgressOrders =
    (charts.data?.inbound.inProgress ?? 0) + (charts.data?.outbound.inProgress ?? 0);
  const readyOrders = charts.data?.outbound.stages.find((s) => s.key === 'shipping')?.count ?? 0;

  const pendingTaskCount = (data?.openTasksByType ?? []).reduce((s, r) => s + r.openCount, 0);
  const inProgressTasks = (data?.openTasksByType ?? []).reduce((s, r) => s + r.inProgressCount, 0);
  const notStartedTasks = Math.max(0, pendingTaskCount - inProgressTasks);

  const activeClients = companies.filter((c) => c.status === 'active').length;
  const suspendedClients = companies.filter(
    (c) => c.status === 'suspended' || c.status === 'restricted',
  ).length;

  const pipelineStages: PipelineStage[] = useMemo(() => {
    const pending = charts.data?.outbound.notInProgress ?? 0;
    const picking = charts.data?.outbound.stages.find((s) => s.key === 'picking')?.count ?? 0;
    const packing = charts.data?.outbound.stages.find((s) => s.key === 'packing')?.count ?? 0;
    const ready = charts.data?.outbound.stages.find((s) => s.key === 'shipping')?.count ?? 0;

    return [
      { key: 'pending', label: 'Pending', count: pending, to: '/orders/outbound?status=confirmed', tone: 'amber' },
      { key: 'picking', label: 'Picking', count: picking, to: '/orders/outbound?status=picking', tone: 'blue' },
      { key: 'packing', label: 'Packing', count: packing, to: '/orders/outbound?status=packing', tone: 'purple' },
      { key: 'ready', label: 'Ready', count: ready, to: '/orders/outbound?status=ready_to_ship', tone: 'green' },
    ];
  }, [charts.data]);

  const attentionItems: AttentionItem[] = useMemo(() => {
    const items: AttentionItem[] = [];
    for (const row of suspendedQuery.data ?? []) {
      items.push({
        id: `sus-${row.companyId}`,
        severity: 'critical',
        title: row.companyName,
        description: `${t('Account suspended')} · ${row.suspendedSince ? new Date(row.suspendedSince).toLocaleDateString() : ''}`,
        actionLabel: t('Restore'),
        to: `/billing/plans/${row.companyId}`,
        onAction: canMutate
          ? () => {
              if (row.billingPlanId) {
                if (
                  !window.confirm(
                    `Renew billing plan for ${row.companyName}? This restores access and starts a new billing cycle.`,
                  )
                ) {
                  return;
                }
                renewMut.mutate(row.billingPlanId);
                return;
              }
              restoreMut.mutate(row.companyId);
            }
          : undefined,
        actionDisabled: renewMut.isPending || restoreMut.isPending,
      });
    }

    const pickingCount = pipelineStages.find((s) => s.key === 'picking')?.count ?? 0;
    if (pickingCount > 0) {
      items.push({
        id: 'picking',
        severity: 'warning',
        title: `${pickingCount} ${t('outbound orders')}`,
        description: t('Waiting for picking'),
        actionLabel: t('View Orders'),
        to: '/orders/outbound?status=picking',
      });
    }

    const expiringLots = (data?.soonExpiryLots ?? []).filter((lot) => {
      if (!lot.expiryDate) return true;
      const days = (new Date(lot.expiryDate).getTime() - Date.now()) / 86_400_000;
      return days <= 30;
    });
    if (expiringLots.length > 0) {
      items.push({
        id: 'expiry',
        severity: 'warning',
        title: `${expiringLots.length} ${t('products')}`,
        description: t('Expiring within 30 days'),
        actionLabel: t('Review'),
        to: '/inventory/stock',
      });
    }

    const endingSoon = (expiringQuery.data ?? []).filter((r) => r.daysRemaining <= 1);
    if (endingSoon[0]) {
      items.push({
        id: `cycle-${endingSoon[0].id}`,
        severity: 'warning',
        title: `1 ${t('billing cycle')}`,
        description: endingSoon[0].daysRemaining <= 0 ? t('Ending soon') : t('Ending tomorrow'),
        actionLabel: t('Review Billing'),
        to: `/billing/plans/${endingSoon[0].companyId}`,
      });
    }

    return items.slice(0, 4);
  }, [
    suspendedQuery.data,
    pipelineStages,
    data?.soonExpiryLots,
    expiringQuery.data,
    canMutate,
    isArabic,
    renewMut.isPending,
    restoreMut.isPending,
  ]);

  const activityItems: ActivityItem[] = useMemo(() => {
    const selectedName = companies.find((c) => c.id === filters.companyId)?.name;
    const inbound = (data?.recentOrders.inbound ?? [])
      .filter((o) => !filters.companyId || o.companyName === selectedName)
      .map((o) => ({
        id: `in-${o.id}`,
        title: `${t('Inbound order')} ${o.orderNumber}`,
        subtitle: o.companyName,
        at: o.createdAt,
        to: `/orders/inbound/${o.id}`,
        tone: 'blue' as const,
        icon: 'inbound' as const,
      }));
    const outbound = (data?.recentOrders.outbound ?? [])
      .filter((o) => !filters.companyId || o.companyName === selectedName)
      .map((o) => ({
        id: `out-${o.id}`,
        title: `${t('Outbound order')} ${o.orderNumber}`,
        subtitle: o.companyName,
        at: o.createdAt,
        to: `/orders/outbound/${o.id}`,
        tone: 'green' as const,
        icon: 'outbound' as const,
      }));
    const invoices = (invoicesQuery.data ?? []).map((row) => ({
      id: `inv-${row.id}`,
      title: row.invoiceNumber,
      subtitle: row.companyName,
      at: row.createdAt,
      to: `/billing/invoices/${row.id}`,
      tone: row.status === 'paid' ? ('green' as const) : ('amber' as const),
      icon: 'invoice' as const,
    }));
    const suspended = (suspendedQuery.data ?? []).map((row) => ({
      id: `act-sus-${row.companyId}`,
      title: `${row.companyName} — ${t('Account suspended')}`,
      at: row.suspendedSince,
      to: `/billing/plans/${row.companyId}`,
      tone: 'rose' as const,
      icon: 'client' as const,
    }));
    return [...inbound, ...outbound, ...invoices, ...suspended]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 6);
  }, [
    data?.recentOrders,
    invoicesQuery.data,
    suspendedQuery.data,
    filters.companyId,
    companies,
    isArabic,
  ]);

  const topProducts: TopProductRow[] = useMemo(() => {
    const counts = new Map<string, TopProductRow>();
    for (const row of ledgerQuery.data?.items ?? []) {
      const cur = counts.get(row.productId);
      if (cur) {
        cur.moves += 1;
      } else {
        counts.set(row.productId, {
          productId: row.productId,
          name: row.product?.name ?? row.productId,
          sku: row.product?.sku,
          moves: 1,
        });
      }
    }
    return Array.from(counts.values())
      .sort((a, b) => b.moves - a.moves)
      .slice(0, 5);
  }, [ledgerQuery.data?.items]);

  function refetchAll() {
    void overview.refetch();
    void charts.refetch();
    void inboundSeries.refetch();
    void outboundSeries.refetch();
    void ledgerQuery.refetch();
    if (canSeeBilling) {
      void billingSummary.refetch();
      void expiringQuery.refetch();
      void overdueQuery.refetch();
      void invoicesQuery.refetch();
      void suspendedQuery.refetch();
    }
  }

  function handleExport() {
    downloadCsv(`emdad-dashboard-${toYmd(new Date())}.csv`, [
      { metric: 'Open orders', value: openOrderCount },
      { metric: 'Pending tasks', value: pendingTaskCount },
      { metric: 'Storage utilization %', value: data?.capacity.storageUsagePercent ?? 0 },
      { metric: 'Active clients', value: activeClients },
      { metric: 'Revenue this month', value: billingSummary.data?.currentMonthRevenue ?? '' },
    ]);
    toast.success(t('Dashboard exported.'));
  }

  const showPageSkeleton = overview.isPending && !data;

  return (
    <div className="space-y-5">
      <DashboardHeader
        fullName={user?.fullName}
        isArabic={isArabic}
        updatedAt={overview.dataUpdatedAt ? new Date(overview.dataUpdatedAt) : null}
        refreshing={overview.isFetching}
        onRefresh={refetchAll}
        onExport={handleExport}
        notificationCount={unreadCount}
      />

      <DashboardFilters
        warehouses={warehouses}
        companies={companies}
        value={filters}
        onChange={setFilters}
        isArabic={isArabic}
      />

      {overview.isError && !data ? (
        <Alert
          variant="error"
          title={t('Could not load dashboard')}
          action={
            <Alert.Action variant="error" onClick={() => overview.refetch()}>
              {t('Try again')}
            </Alert.Action>
          }
        />
      ) : null}

      {showPageSkeleton ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <KPICard
              title={t('Open Orders')}
              value={numberFmt(openOrderCount)}
              icon={ShoppingCart}
              tone="green"
              to="/orders/outbound"
              trend={orderTrend}
              sparkline={orderSpark}
              breakdown={[
                { label: t('Pending'), value: pendingOrders },
                { label: t('In Progress'), value: inProgressOrders },
                { label: t('Ready'), value: readyOrders },
              ]}
            />
            <KPICard
              title={t('Pending Tasks')}
              value={numberFmt(pendingTaskCount)}
              icon={ClipboardList}
              tone="amber"
              to={canTasks ? '/tasks' : undefined}
              breakdown={[
                { label: t('In Progress'), value: inProgressTasks },
                { label: t('Pending'), value: notStartedTasks },
              ]}
            />
            <KPICard
              title={t('Storage Utilization')}
              value={percentFmt(data?.capacity.storageUsagePercent ?? 0)}
              icon={Boxes}
              tone="blue"
              to="/billing/plans"
              breakdown={[
                {
                  label: `${t('CBM')} ${t('used')}`,
                  value: `${cbmNumber(data?.capacity.usedStorageCbm).toFixed(0)} / ${cbmNumber(data?.capacity.reservedStorageCbm).toFixed(0)}`,
                },
              ]}
            />
            <KPICard
              title={t('Active Clients')}
              value={numberFmt(activeClients || data?.counters.totalCustomers || 0)}
              icon={Users}
              tone="purple"
              to={canClients ? '/clients' : undefined}
              breakdown={
                suspendedClients > 0
                  ? [{ label: t('Suspended'), value: suspendedClients }]
                  : undefined
              }
            />
            <KPICard
              title={t('Revenue (This Month)')}
              value={canSeeBilling ? `$${formatDecimal(billingSummary.data?.currentMonthRevenue ?? 0)}` : '—'}
              icon={DollarSign}
              tone="green"
              to={canBilling ? '/billing/invoices' : undefined}
              breakdown={
                canSeeBilling
                  ? [{ label: t('Invoices'), value: billingSummary.data?.openInvoiceCount ?? 0 }]
                  : undefined
              }
            />
          </div>

          <div className="grid gap-3 xl:grid-cols-12">
            <div className="min-w-0 xl:col-span-6">
              <OperationsOverview
                data={opsPoints}
                taskData={taskChartPoints}
                period={filters.period}
                onPeriodChange={(period) => setFilters((f) => ({ ...f, period }))}
                isArabic={isArabic}
                isLoading={inboundSeries.isPending || outboundSeries.isPending}
                isError={inboundSeries.isError || outboundSeries.isError}
                onRetry={() => {
                  void inboundSeries.refetch();
                  void outboundSeries.refetch();
                }}
              />
            </div>
            <div className="min-w-0 xl:col-span-3">
              <NeedsAttention items={attentionItems} isArabic={isArabic} />
            </div>
            <div className="min-w-0 xl:col-span-3">
              <QuickActions
                isArabic={isArabic}
                canClients={canClients}
                canBilling={canBilling}
                canProducts={canProducts}
                canWarehouses={canWarehouses}
              />
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <OutboundPipeline stages={pipelineStages} isArabic={isArabic} />
            <WarehouseTasks
              rows={data?.openTasksByType ?? []}
              isArabic={isArabic}
              canOpenTasks={canTasks}
            />
            <StorageUtilization
              usedCbm={data?.capacity.usedStorageCbm ?? 0}
              reservedCbm={data?.capacity.reservedStorageCbm ?? 0}
              remainingCbm={data?.capacity.remainingStorageCbm ?? 0}
              percent={data?.capacity.storageUsagePercent ?? 0}
              warehouses={warehouses}
              canOpenWarehouses={canWarehouses}
              isArabic={isArabic}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {canSeeBilling ? (
              <BillingClients
                expiring={expiringQuery.data ?? []}
                overdue={overdueQuery.data ?? []}
                invoices={invoicesQuery.data ?? []}
                canMutate={canMutate}
                isArabic={isArabic}
                onResolveOverdue={(planId, name) => {
                  if (
                    !window.confirm(
                      `Renew billing plan for ${name}? This restores access and starts a new billing cycle.`,
                    )
                  ) {
                    return;
                  }
                  renewMut.mutate(planId);
                }}
                renewPending={renewMut.isPending}
                isError={expiringQuery.isError || overdueQuery.isError || invoicesQuery.isError}
                onRetry={() => {
                  void expiringQuery.refetch();
                  void overdueQuery.refetch();
                  void invoicesQuery.refetch();
                }}
              />
            ) : (
              <div />
            )}
            <RecentActivity items={activityItems} isArabic={isArabic} />
            <TopProducts
              rows={topProducts}
              isArabic={isArabic}
              isError={ledgerQuery.isError}
              onRetry={() => void ledgerQuery.refetch()}
            />
          </div>
        </>
      )}
    </div>
  );
}
