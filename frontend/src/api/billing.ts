import { api } from './client';

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
  async listPlans(companyId?: string): Promise<BillingPlanRow[]> {
    const params = companyId ? { companyId } : {};
    const { data } = await api.get<BillingPlanRow[]>('/billing/plans', { params });
    return data;
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

  async listInvoices(companyId?: string): Promise<BillingInvoiceRow[]> {
    const params = companyId ? { companyId } : {};
    const { data } = await api.get<BillingInvoiceRow[]>('/billing/invoices', { params });
    return data;
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
};
