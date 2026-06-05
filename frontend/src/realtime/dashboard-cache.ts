import type { QueryClient } from '@tanstack/react-query';

import type { DashboardOverview, OpenOrdersCharts } from '../api/dashboard';
import { normalizeOpenOrdersChartSide, normalizeOpenTasksByType } from '../api/dashboard';
import { QK } from '../constants/query-keys';

type PartialOverview = Partial<DashboardOverview> & {
  counters?: Partial<DashboardOverview['counters']> & { activeUsers?: number };
  openOrders?: Partial<DashboardOverview['openOrders']>;
  capacity?: Partial<DashboardOverview['capacity']>;
};

function mergeOverview(prev: DashboardOverview, patch: PartialOverview): DashboardOverview {
  return {
    ...prev,
    counters: { ...prev.counters, ...(patch.counters ?? {}) },
    openOrders: { ...prev.openOrders, ...(patch.openOrders ?? {}) },
    openTasksByType: patch.openTasksByType
      ? normalizeOpenTasksByType(patch.openTasksByType as Array<Record<string, unknown>>)
      : prev.openTasksByType,
    capacity: patch.capacity ? { ...prev.capacity, ...patch.capacity } : prev.capacity,
    soonExpiryLots: patch.soonExpiryLots ?? prev.soonExpiryLots,
    recentOrders: patch.recentOrders
      ? {
          inbound: patch.recentOrders.inbound ?? prev.recentOrders.inbound,
          outbound: patch.recentOrders.outbound ?? prev.recentOrders.outbound,
        }
      : prev.recentOrders,
  };
}

export function patchDashboardKpi(qc: QueryClient, patch: PartialOverview): void {
  qc.setQueryData<DashboardOverview>(QK.dashboardOverview, (prev) => {
    if (!prev) return prev;
    return mergeOverview(prev, patch);
  });
}

export function patchDashboardInventory(qc: QueryClient, patch: PartialOverview): void {
  patchDashboardKpi(qc, patch);
}

export function patchDashboardOrders(
  qc: QueryClient,
  patch: PartialOverview & { openOrdersCharts?: OpenOrdersCharts },
): void {
  patchDashboardKpi(qc, patch);
  if (patch.openOrdersCharts) {
    qc.setQueryData<OpenOrdersCharts>(QK.dashboardOpenOrdersCharts, {
      inbound: normalizeOpenOrdersChartSide(patch.openOrdersCharts.inbound),
      outbound: normalizeOpenOrdersChartSide(patch.openOrdersCharts.outbound),
    });
  }
}

export function patchDashboardTasks(
  qc: QueryClient,
  patch: PartialOverview & { openOrdersCharts?: OpenOrdersCharts },
): void {
  patchDashboardKpi(qc, patch);
  if (patch.openOrdersCharts) {
    qc.setQueryData<OpenOrdersCharts>(QK.dashboardOpenOrdersCharts, {
      inbound: normalizeOpenOrdersChartSide(patch.openOrdersCharts.inbound),
      outbound: normalizeOpenOrdersChartSide(patch.openOrdersCharts.outbound),
    });
  }
}
