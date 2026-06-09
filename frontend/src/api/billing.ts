import { api, type PageResult } from './client';

export type BillingCycleStatus = 'active' | 'expired' | 'renewed';

export type BillingPlanRow = {
  id: string;
  companyId: string;
  active: boolean;
  cycleLengthDays: number;
  fixedSubscriptionFee: string;
  inboundOrderFee: string;
  outboundOrderFee: string;
  packagingFee: string;
  qualityCheckFee: string;
  excessVolumeFeePerDay: string;
  excessWeightFeePerDay: string;
  reservedVolume: string;
  reservedWeight: string;
  createdAt: string;
  updatedAt: string;
};

export type BillingCycleRow = {
  id: string;
  companyId: string;
  billingPlanId: string;
  startsAt: string;
  endsAt: string;
  status: BillingCycleStatus;
  createdAt: string;
  updatedAt: string;
};

export type BillingCapacitySummary = {
  totalWarehouseVolumeCbm: string;
  allocatableCapacityCbm: string;
  allocatedVolumeCbm: string;
  remainingAllocatableCbm: string;
  allocationRatio: number;
};

export type CreateBillingPlanPayload = {
  companyId: string;
  active?: boolean;
  cycleLengthDays: number;
  fixedSubscriptionFee?: number;
  inboundOrderFee?: number;
  outboundOrderFee?: number;
  packagingFee?: number;
  qualityCheckFee?: number;
  excessVolumeFeePerDay?: number;
  excessWeightFeePerDay?: number;
  reservedVolume?: number;
  reservedWeight?: number;
  cycleStartsAt?: string;
};

export type UpdateBillingPlanPayload = Partial<
  Omit<CreateBillingPlanPayload, 'companyId' | 'cycleStartsAt'>
>;

export type BillingInvoiceStatus = 'draft' | 'open' | 'paid' | 'cancelled';

export type BillingInvoiceLineType =
  | 'subscription'
  | 'inbound'
  | 'outbound'
  | 'packaging'
  | 'quality_check'
  | 'excess_volume'
  | 'excess_weight';

export type BillingInvoiceLineRow = {
  id: string;
  type: BillingInvoiceLineType;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
};

export type BillingInvoiceCycleSummary = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: BillingCycleStatus;
  rateSnapshot: unknown;
  billingPlanId: string;
};

export type BillingRateSnapshot = {
  billingPlanId: string;
  fixedSubscriptionFee: string;
  inboundOrderFee: string;
  outboundOrderFee: string;
  packagingFee: string;
  qualityCheckFee: string;
  excessVolumeFeePerDay: string;
  excessWeightFeePerDay: string;
  reservedVolume: string;
  reservedWeight: string;
  snapshottedAt: string;
};

export type BillingInvoiceRow = {
  id: string;
  companyId: string;
  billingCycleId: string;
  invoiceNumber: string;
  status: BillingInvoiceStatus;
  totalAmount: string;
  issuedAt: string | null;
  createdAt: string;
  updatedAt: string;
  billingCycle?: BillingInvoiceCycleSummary;
  lines?: BillingInvoiceLineRow[];
};

export type BillingPlanOverviewItem = {
  plan: BillingPlanRow;
  companyId: string;
  companyName: string;
  companyStatus: string;
  currentCycle: BillingCycleRow | null;
  cycleStart: string | null;
  cycleEnd: string | null;
  daysRemaining: number | null;
  cycleStatus: 'active' | 'renewed' | 'expired' | 'none';
  billingStatus: 'operational' | 'restricted' | 'inactive';
};

export type ListBillingPlansParams = {
  companyId?: string;
  search?: string;
  cycleStatus?: '' | 'active' | 'renewed' | 'expired' | 'none';
  daysRemaining?: '' | 'critical' | 'warning' | 'healthy' | 'expired' | 'none';
  billingStatus?: '' | 'operational' | 'restricted' | 'inactive';
  expiryFrom?: string;
  expiryTo?: string;
  sort_by?:
    | 'companyName'
    | 'cycleStart'
    | 'cycleEnd'
    | 'daysRemaining'
    | 'cycleLengthDays'
    | 'fixedSubscriptionFee'
    | 'createdAt';
  sort_dir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
};

export type ListBillingInvoicesParams = {
  companyId?: string;
  search?: string;
  status?: BillingInvoiceStatus | '';
  cycleStatus?: BillingCycleStatus | '';
  createdFrom?: string;
  createdTo?: string;
  expiryFrom?: string;
  expiryTo?: string;
  sort_by?: 'createdAt' | 'invoiceNumber' | 'totalAmount' | 'status' | 'issuedAt';
  sort_dir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
};

export type BillingOverdueClientRow = {
  companyId: string;
  companyName: string;
  status: string;
  lastCycleEndedAt: string | null;
  restrictedSince: string;
};

export type BillingRecentInvoiceRow = {
  id: string;
  companyId: string;
  companyName: string;
  invoiceNumber: string;
  status: BillingInvoiceStatus;
  totalAmount: string;
  createdAt: string;
};

export type BillingSuspendedAccountRow = {
  companyId: string;
  companyName: string;
  status: string;
  suspendedSince: string;
};

export type BillingExpiringCycleRow = {
  id: string;
  companyId: string;
  billingPlanId: string;
  startsAt: string;
  endsAt: string;
  status: BillingCycleStatus;
  rateSnapshot: unknown;
  createdAt: string;
  updatedAt: string;
  daysRemaining: number;
  company: { id: string; name: string };
};

export const BillingApi = {
  async listPlansPage(
    params: ListBillingPlansParams = {},
  ): Promise<PageResult<BillingPlanOverviewItem>> {
    const { data } = await api.get<PageResult<BillingPlanOverviewItem>>('/billing/plans', {
      params,
    });
    return data;
  },

  /** Detail pages — all plans for one client (unpaginated slice). */
  async listPlans(companyId?: string): Promise<BillingPlanRow[]> {
    const { data } = await api.get<PageResult<BillingPlanOverviewItem>>('/billing/plans', {
      params: { companyId, limit: 100, offset: 0 },
    });
    return data.items.map((row) => row.plan);
  },

  async getPlan(id: string): Promise<BillingPlanRow> {
    const { data } = await api.get<BillingPlanRow>(`/billing/plans/${id}`);
    return data;
  },

  async createPlan(payload: CreateBillingPlanPayload): Promise<BillingPlanRow> {
    const { data } = await api.post<BillingPlanRow>('/billing/plans', payload);
    return data;
  },

  async updatePlan(id: string, payload: UpdateBillingPlanPayload): Promise<BillingPlanRow> {
    const { data } = await api.patch<BillingPlanRow>(`/billing/plans/${id}`, payload);
    return data;
  },

  async listCycles(companyId?: string): Promise<BillingCycleRow[]> {
    const params = companyId ? { companyId } : {};
    const { data } = await api.get<BillingCycleRow[]>('/billing/cycles', { params });
    return data;
  },

  async renewCycle(cycleId: string): Promise<BillingCycleRow> {
    const { data } = await api.post<BillingCycleRow>(`/billing/cycles/${cycleId}/renew`);
    return data;
  },

  async getCapacitySummary(): Promise<BillingCapacitySummary> {
    const { data } = await api.get<BillingCapacitySummary>('/billing/capacity');
    return data;
  },

  async listInvoicesPage(
    params: ListBillingInvoicesParams = {},
  ): Promise<PageResult<BillingInvoiceRow>> {
    const { data } = await api.get<PageResult<BillingInvoiceRow>>('/billing/invoices', { params });
    return data;
  },

  async listInvoices(companyId?: string): Promise<BillingInvoiceRow[]> {
    const { data } = await api.get<PageResult<BillingInvoiceRow>>('/billing/invoices', {
      params: { companyId, limit: 200, offset: 0 },
    });
    return data.items;
  },

  async getInvoice(id: string): Promise<BillingInvoiceRow> {
    const { data } = await api.get<BillingInvoiceRow>(`/billing/invoices/${id}`);
    return data;
  },

  async listExpiringSoon(limit = 5): Promise<BillingExpiringCycleRow[]> {
    const { data } = await api.get<BillingExpiringCycleRow[]>('/billing/cycles/expiring-soon', {
      params: { limit },
    });
    return data;
  },

  async listOverdueClients(limit = 5): Promise<BillingOverdueClientRow[]> {
    const { data } = await api.get<BillingOverdueClientRow[]>(
      '/billing/dashboard/overdue-clients',
      { params: { limit } },
    );
    return data;
  },

  async listRecentInvoices(limit = 5): Promise<BillingRecentInvoiceRow[]> {
    const { data } = await api.get<BillingRecentInvoiceRow[]>(
      '/billing/dashboard/recent-invoices',
      { params: { limit } },
    );
    return data;
  },

  async listSuspendedAccounts(limit = 5): Promise<BillingSuspendedAccountRow[]> {
    const { data } = await api.get<BillingSuspendedAccountRow[]>(
      '/billing/dashboard/suspended-accounts',
      { params: { limit } },
    );
    return data;
  },
};
