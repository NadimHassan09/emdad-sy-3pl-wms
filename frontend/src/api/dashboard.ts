import { api } from './client';

export type DashboardChartSlice = { key: string; label: string; count: number };

export type OpenOrdersCharts = {
  inbound: DashboardChartSlice[];
  outbound: DashboardChartSlice[];
};

export const DashboardApi = {
  async openOrdersCharts(): Promise<OpenOrdersCharts> {
    const { data } = await api.get<OpenOrdersCharts>('/dashboard/open-orders-charts');
    return data;
  },
};
