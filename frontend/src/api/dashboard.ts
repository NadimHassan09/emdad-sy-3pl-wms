import { api } from './client';

export type DashboardChartSlice = { key: string; label: string; count: number };

export type OpenOrdersCharts = {
  inbound: DashboardChartSlice[];
  outbound: DashboardChartSlice[];
};

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
  openTasksByType: Array<{ key: string; label: string; count: number }>;
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
    const { data } = await api.get<OpenOrdersCharts>('/dashboard/open-orders-charts');
    return data;
  },
};
