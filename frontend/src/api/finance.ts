import { api } from './client';

export type FinancialOverviewData = {
  totalClientBalances: string;
  totalAvailableBalances: string;
  totalPendingCod: string;
  totalPayoutLocked: string;
  totalCredits: string;
  totalDebits: string;
  payoutsPendingCount: number;
  totalPayoutsPending: string;
  payoutsCompletedCount: number;
  totalPayoutsCompleted: string;
  shippingChargesCount: number;
  totalShippingCharges: string;
};

export type ClientFinancialAccountRow = {
  id: string;
  companyId: string;
  currentBalance: string;
  availableBalance: string;
  pendingBalance: string;
  payoutLocked: string;
  totalCredits: string;
  totalDebits: string;
  currency: string;
  status: 'active' | 'restricted' | 'frozen';
  lastTransactionAt: string | null;
  updatedAt: string;
  company?: {
    id: string;
    name: string;
    tradeName?: string | null;
    status: string;
  };
};

export type FinancialTransactionRow = {
  id: string;
  companyId: string;
  transactionNumber: string;
  type: 'credit' | 'debit';
  category: string;
  amount: string;
  currency: string;
  description: string;
  referenceType: string | null;
  referenceId: string | null;
  status: 'posted' | 'reversed';
  createdAt: string;
  company?: {
    id: string;
    name: string;
    tradeName?: string | null;
  };
};

export type CodFinancialRow = {
  id: string;
  companyId: string;
  omsOrderId: string;
  originalAmount: string;
  currentAmount: string;
  currency: string;
  status: 'pending' | 'available' | 'paid_out' | 'returned';
  carrierCollectedAt: string | null;
  carrierRemittedAt: string | null;
  remittanceReference: string | null;
  creditedToAccountAt: string | null;
  createdAt: string;
  company?: {
    id: string;
    name: string;
  };
  omsOrder?: {
    id: string;
    orderNumber: string;
    status: string;
    recipientName: string | null;
    trackingNumber: string | null;
    shippingMethod: string | null;
    shippingProviderCode: string | null;
  };
};

export type ClientPayoutRow = {
  id: string;
  payoutNumber: string;
  companyId: string;
  amount: string;
  currency: string;
  status: 'requested' | 'approved' | 'rejected' | 'paid' | 'failed';
  bankName: string | null;
  accountHolder: string | null;
  accountNumber: string | null;
  iban: string | null;
  notes: string | null;
  rejectionReason: string | null;
  payoutReference: string | null;
  paidAt: string | null;
  createdAt: string;
  company?: {
    id: string;
    name: string;
    tradeName?: string | null;
  };
};

export type FinancialPolicyRow = {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updatedAt: string;
};

export type CarrierCostRow = {
  id: string;
  outboundOrderId: string;
  outboundOrderNumber?: string;
  clientName?: string;
  providerCode: string;
  providerName: string;
  externalAwb: string | null;
  trackingNumber: string | null;
  status: string;
  shippingCost: string | null;
  currency: string;
  shippingCostSource: string | null;
  shippingCostEventAt: string | null;
  costPaidAt: string | null;
  costPaidReference: string | null;
  recentCostChanges: Array<{
    id: string;
    amount: string;
    currency: string | null;
    source: string;
    skipReason: string | null;
    applied: boolean;
    eventAt: string | null;
    createdAt: string;
  }>;
  createdAt: string;
};

export const FinanceApi = {
  getOverview: async () => {
    const res = await api.get<FinancialOverviewData>('/finance/overview');
    return res.data;
  },

  listAccounts: async (params?: { search?: string; status?: string; page?: number; limit?: number }) => {
    const res = await api.get<{
      items: ClientFinancialAccountRow[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>('/finance/accounts', { params });
    return res.data;
  },

  getAccount: async (companyId: string) => {
    const res = await api.get<ClientFinancialAccountRow>(`/finance/accounts/${companyId}`);
    return res.data;
  },

  listTransactions: async (params?: Record<string, any>) => {
    const res = await api.get<{
      items: FinancialTransactionRow[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>('/finance/transactions', { params });
    return res.data;
  },

  exportTransactions: async (
    params: Record<string, unknown> & { format?: 'xlsx' | 'csv' } = {},
  ): Promise<Blob> => {
    const res = await api.get('/finance/transactions/export', {
      params: { format: 'xlsx', ...params },
      responseType: 'blob',
    });
    return res.data;
  },

  createAdjustment: async (payload: {
    companyId: string;
    type: 'credit' | 'debit';
    amount: number;
    description: string;
    category?: string;
    referenceType?: string;
    referenceId?: string;
  }) => {
    const res = await api.post('/finance/transactions/adjustment', payload);
    return res.data;
  },

  listCod: async (params?: Record<string, any>) => {
    const res = await api.get<{
      items: CodFinancialRow[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>('/finance/cod', { params });
    return res.data;
  },

  confirmCodCollection: async (id: string, payload?: { notes?: string }) => {
    const res = await api.post(`/finance/cod/${id}/confirm-collection`, payload ?? {});
    return res.data;
  },

  confirmCodRemittance: async (id: string, payload?: { remittanceReference?: string; notes?: string }) => {
    const res = await api.post(`/finance/cod/${id}/confirm-remittance`, payload ?? {});
    return res.data;
  },

  listPayouts: async (params?: Record<string, any>) => {
    const res = await api.get<{
      items: ClientPayoutRow[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>('/finance/payouts', { params });
    return res.data;
  },

  reviewPayout: async (id: string, payload: { status: 'approved' | 'rejected'; rejectionReason?: string }) => {
    const res = await api.patch(`/finance/payouts/${id}/review`, payload);
    return res.data;
  },

  recordPayoutPaid: async (id: string, payload: { payoutReference?: string; notes?: string }) => {
    const res = await api.post(`/finance/payouts/${id}/record-paid`, payload);
    return res.data;
  },

  getPolicies: async () => {
    const res = await api.get<FinancialPolicyRow[]>('/finance/policies');
    return res.data;
  },

  updatePolicy: async (key: string, payload: { value: string; description?: string }) => {
    const res = await api.put(`/finance/policies/${key}`, payload);
    return res.data;
  },

  listCarrierCosts: async (params?: Record<string, any>) => {
    const res = await api.get<{
      items: CarrierCostRow[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>('/finance/carrier-costs', { params });
    return res.data;
  },

  markCarrierCostPaid: async (id: string, payload: { reference?: string; notes?: string }) => {
    const res = await api.post(`/finance/carrier-costs/${id}/mark-paid`, payload);
    return res.data;
  },
};
