import { api } from './client';

export type DashboardChartSlice = { key: string; label: string; count: number };

export type OpenOrdersChartSide = {
  stages: DashboardChartSlice[];
  inProgress: number;
  notInProgress: number;
};

export type OpenOrdersCharts = {
  inbound: OpenOrdersChartSide;
  outbound: OpenOrdersChartSide;
};

/** Supports legacy array responses and fills progress counts when missing. */
export function normalizeOpenOrdersChartSide(
  raw: OpenOrdersChartSide | DashboardChartSlice[] | undefined,
): OpenOrdersChartSide {
  if (!raw) {
    return { stages: [], inProgress: 0, notInProgress: 0 };
  }

  if (Array.isArray(raw)) {
    const stages = raw;
    const notInProgress = stages[0]?.count ?? 0;
    const inProgress = stages.slice(1).reduce((sum, slice) => sum + slice.count, 0);
    return { stages, inProgress, notInProgress };
  }

  const stages = raw.stages ?? [];
  let inProgress = raw.inProgress ?? 0;
  let notInProgress = raw.notInProgress ?? 0;
  const counted = inProgress + notInProgress;
  const stageSum = stages.reduce((sum, slice) => sum + slice.count, 0);

  if (counted === 0 && stageSum > 0) {
    notInProgress = stages[0]?.count ?? 0;
    inProgress = stages.slice(1).reduce((sum, slice) => sum + slice.count, 0);
  }

  return { stages, inProgress, notInProgress };
}

export type DashboardOverview = {
  counters: {
    totalItemsInStock: number;
    itemsInCatalog: number;
    totalCustomers: number;
  };
  openOrders: {
    inbound: number;
    outbound: number;
  };
  openTasksByType: Array<{
    key: string;
    label: string;
    openCount: number;
    completedCount: number;
  }>;
  capacity: {
    occupiedLocations: number;
    totalStorageLocations: number;
    consumedPercent: number;
  };
  soonExpiryLots: Array<{
    lotId: string;
    lotNumber: string;
    expiryDate: string | null;
    productId: string;
    productName: string;
    locationId: string;
    locationName: string;
    lotQuantity: number;
    productTotalQuantity: number;
  }>;
  recentOrders: {
    inbound: Array<{ id: string; orderNumber: string; status: string; companyName: string; createdAt: string }>;
    outbound: Array<{ id: string; orderNumber: string; status: string; companyName: string; createdAt: string }>;
  };
};

export const DashboardApi = {
  async overview(): Promise<DashboardOverview> {
    const { data } = await api.get<DashboardOverview>('/dashboard/overview');
    return data;
  },

  async openOrdersCharts(): Promise<OpenOrdersCharts> {
    const { data } = await api.get<OpenOrdersCharts | { inbound: DashboardChartSlice[]; outbound: DashboardChartSlice[] }>(
      '/dashboard/open-orders-charts',
    );
    return {
      inbound: normalizeOpenOrdersChartSide(data.inbound as OpenOrdersChartSide | DashboardChartSlice[]),
      outbound: normalizeOpenOrdersChartSide(data.outbound as OpenOrdersChartSide | DashboardChartSlice[]),
    };
  },
};
