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
};
