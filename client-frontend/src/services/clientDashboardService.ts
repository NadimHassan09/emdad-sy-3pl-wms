import { apiClient } from './apiClient';

export type ClientDashboardOverview = {
  productsCount: number;
  openInboundOrders: number;
  openOutboundOrders: number;
  activeOrders: number;
  expiringProductsCount: number;
  storage: {
    usedVolumeCbm: string;
    usedWeightKg: string;
    reservedVolumeCbm: string | null;
    reservedWeightKg: string | null;
    utilizationPercent: number | null;
  };
  billing: {
    daysUntilExpiration: number | null;
    currentInvoiceAmount: string | null;
    accountStatus: 'active' | 'expiring' | 'restricted';
  } | null;
};

export async function fetchClientDashboardOverview(): Promise<ClientDashboardOverview> {
  const { data } = await apiClient.get<ClientDashboardOverview>('/dashboard/overview');
  return data;
}
