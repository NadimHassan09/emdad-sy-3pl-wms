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
  outboundBaseFee: string;
  outboundIncludedItems: number;
  outboundAdditionalItemFee: string;
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
  usedStorageCbm: string;
  reservedStorageCbm: string;
  remainingStorageCbm: string;
  storageUsagePercent: number;
  /** Legacy aliases mapped to inventory-based storage */
  totalWarehouseVolumeCbm: string;
  allocatableCapacityCbm: string;
  allocatedVolumeCbm: string;
  remainingAllocatableCbm: string;
  totalWarehouseWeightKg: string;
  allocatableCapacityKg: string;
  allocatedWeightKg: string;
  remainingAllocatableKg: string;
  allocationRatio: number;
  sparePoolRatio: number;
  basis?: 'inventory_product_cbm';
};

export type CompanyStorageSummary = {
  companyId: string;
  usedStorageCbm: string;
  reservedStorageCbm: string;
  remainingStorageCbm: string;
  storageUsagePercent: number;
  basis: 'inventory_product_cbm';
};

export type BillingDashboardSummary = {
  outstandingAmount: string;
  currentMonthRevenue: string;
  openInvoiceCount: number;
  overdueInvoiceCount: number;
  suspendedAccountCount: number;
};

export type BillingExpiringBuckets = {
  expiring30: Array<{ companyId: string; companyName: string; cycleId: string; daysRemaining: number; endsAt: string }>;
  expiring14: Array<{ companyId: string; companyName: string; cycleId: string; daysRemaining: number; endsAt: string }>;
  expiring7: Array<{ companyId: string; companyName: string; cycleId: string; daysRemaining: number; endsAt: string }>;
  expiring3: Array<{ companyId: string; companyName: string; cycleId: string; daysRemaining: number; endsAt: string }>;
  expired: Array<{ companyId: string; companyName: string; cycleId: string; daysRemaining: number; endsAt: string }>;
  suspended: Array<{ companyId: string; companyName: string; cycleId: string; daysRemaining: number; endsAt: string }>;
};

export type BillingCyclePreview = {
  companyId: string;
  plan: {
    id: string;
    cycleLengthDays: number;
    reservedVolume: string;
    reservedWeight: string;
    fixedSubscriptionFee: string;
    outboundBaseFee: string;
    outboundIncludedItems: number;
    outboundAdditionalItemFee: string;
  };
  cycle: { id: string; startsAt: string; endsAt: string; status: string; daysRemaining: number; rateSnapshot: unknown };
  usage: { usedVolumeCbm: string; usedWeightKg: string; allocatedVolumeCbm: string; allocatedWeightKg: string };
  preview: {
    invoiceId: string;
    invoiceNumber: string;
    status: string;
    subtotal: string;
    tax: string;
    discount: string;
    grandTotal: string;
    vatPercentage: string;
    discountType: 'fixed' | 'percentage' | null;
    discountValue: string | null;
    lines: BillingInvoiceLineRow[];
  } | null;
};

export type CreateBillingPlanPayload = {
  companyId: string;
  active?: boolean;
  cycleLengthDays: number;
  fixedSubscriptionFee?: number;
  inboundOrderFee?: number;
  outboundOrderFee?: number;
  outboundBaseFee?: number;
  outboundIncludedItems?: number;
  outboundAdditionalItemFee?: number;
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

export type BillingInvoiceStatus = 'draft' | 'unpaid' | 'paid' | 'cancelled' | 'open' | 'overdue';

export type BillingInvoiceSource = 'cycle' | 'ad_hoc';

export type BillingInvoiceLineSource = 'system' | 'manual' | 'order';

export type BillingInvoiceLineType =
  | 'subscription'
  | 'inbound'
  | 'outbound'
  | 'packaging'
  | 'quality_check'
  | 'excess_volume'
  | 'excess_weight'
  | 'manual'
  | 'order_charge';

export type BillingInvoiceLineRow = {
  id: string;
  type: BillingInvoiceLineType;
  lineSource: BillingInvoiceLineSource;
  description: string | null;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  orderChargeId?: string | null;
  createdAt?: string;
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
  outboundBaseFee: string;
  outboundIncludedItems: number;
  outboundAdditionalItemFee: string;
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
  billingCycleId: string | null;
  invoiceSource: BillingInvoiceSource;
  invoiceNumber: string;
  status: BillingInvoiceStatus;
  subtotalAmount: string;
  discountType: 'fixed' | 'percentage' | null;
  discountValue: string | null;
  discountAmount: string;
  vatPercentage: string;
  vatAmount: string;
  grandTotal: string;
  totalAmount: string;
  issuedAt: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  billingCycle?: BillingInvoiceCycleSummary | null;
  lines?: BillingInvoiceLineRow[];
};

export type OrderManualChargeRow = {
  id: string;
  companyId: string;
  referenceType: string;
  referenceId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  createdBy: string | null;
  createdAt: string;
};

export type CreateManualInvoiceLinePayload = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type CreateAdHocInvoicePayload = {
  companyId: string;
  invoiceDate: string;
  dueDate: string;
  lines: CreateManualInvoiceLinePayload[];
};

export type UpdateInvoicePayload = {
  invoiceDate?: string;
  dueDate?: string;
  discountType?: 'fixed' | 'percentage' | null;
  discountValue?: number | null;
  vatPercentage?: number;
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

  async getCompanyStorage(companyId: string): Promise<CompanyStorageSummary> {
    const { data } = await api.get<CompanyStorageSummary>(
      `/billing/companies/${companyId}/storage`,
    );
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

  async createAdHocInvoice(payload: CreateAdHocInvoicePayload): Promise<BillingInvoiceRow> {
    const { data } = await api.post<BillingInvoiceRow>('/billing/invoices/ad-hoc', payload);
    return data;
  },

  async updateInvoice(id: string, payload: UpdateInvoicePayload): Promise<BillingInvoiceRow> {
    const { data } = await api.patch<BillingInvoiceRow>(`/billing/invoices/${id}`, payload);
    return data;
  },

  async issueInvoice(id: string): Promise<BillingInvoiceRow> {
    const { data } = await api.post<BillingInvoiceRow>(`/billing/invoices/${id}/issue`);
    return data;
  },

  async addManualLine(
    invoiceId: string,
    payload: CreateManualInvoiceLinePayload,
  ): Promise<BillingInvoiceLineRow> {
    const { data } = await api.post(`/billing/invoices/${invoiceId}/lines`, payload);
    return data;
  },

  async updateManualLine(
    invoiceId: string,
    lineId: string,
    payload: Partial<CreateManualInvoiceLinePayload>,
  ): Promise<BillingInvoiceLineRow> {
    const { data } = await api.patch(`/billing/invoices/${invoiceId}/lines/${lineId}`, payload);
    return data;
  },

  async removeManualLine(invoiceId: string, lineId: string): Promise<void> {
    await api.delete(`/billing/invoices/${invoiceId}/lines/${lineId}`);
  },

  async downloadInvoicePdf(id: string): Promise<Blob> {
    const { data } = await api.get<Blob>(`/billing/invoices/${id}/pdf`, {
      responseType: 'blob',
    });
    return data;
  },

  async listOrderCharges(
    referenceType: string,
    referenceId: string,
  ): Promise<OrderManualChargeRow[]> {
    const { data } = await api.get<OrderManualChargeRow[]>('/billing/order-charges', {
      params: { referenceType, referenceId },
    });
    return data;
  },

  async createOrderCharge(payload: {
    referenceType: string;
    referenceId: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }): Promise<OrderManualChargeRow> {
    const { data } = await api.post<OrderManualChargeRow>('/billing/order-charges', payload);
    return data;
  },

  async deleteOrderCharge(id: string): Promise<void> {
    await api.delete(`/billing/order-charges/${id}`);
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

  async getDashboardSummary(): Promise<BillingDashboardSummary> {
    const { data } = await api.get<BillingDashboardSummary>('/billing/dashboard/summary');
    return data;
  },

  async getExpiringBuckets(): Promise<BillingExpiringBuckets> {
    const { data } = await api.get<BillingExpiringBuckets>('/billing/dashboard/expiring-buckets');
    return data;
  },

  async getCyclePreview(companyId: string): Promise<BillingCyclePreview> {
    const { data } = await api.get<BillingCyclePreview>('/billing/preview', {
      params: { companyId },
    });
    return data;
  },

  async updateInvoiceStatus(
    id: string,
    status: 'paid' | 'cancelled' | 'unpaid',
  ): Promise<BillingInvoiceRow> {
    const { data } = await api.patch<BillingInvoiceRow>(`/billing/invoices/${id}/status`, {
      status,
    });
    return data;
  },
};
