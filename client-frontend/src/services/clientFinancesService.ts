import { apiClient } from './apiClient';

export interface ClientFinancialAccount {
  id: string;
  companyId: string;
  currentBalance: string | number;
  availableBalance: string | number;
  pendingBalance: string | number;
  payoutLocked: string | number;
  totalCredits: string | number;
  totalDebits: string | number;
  currency: string;
  status: 'active' | 'restricted' | 'frozen';
  lastTransactionAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientFinancialTransaction {
  id: string;
  companyId: string;
  transactionNumber: string;
  type: 'credit' | 'debit';
  category: string;
  amount: string | number;
  currency: string;
  description: string;
  referenceType?: string | null;
  referenceId?: string | null;
  status: string;
  createdAt: string;
}

export interface ClientPayoutRecord {
  id: string;
  companyId: string;
  payoutNumber: string;
  amount: string | number;
  currency: string;
  status: 'requested' | 'approved' | 'rejected' | 'paid' | 'failed';
  bankName?: string | null;
  accountNumber?: string | null;
  iban?: string | null;
  notes?: string | null;
  payoutReference?: string | null;
  rejectionReason?: string | null;
  requestedAt: string;
  reviewedAt?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

export interface ClientCodRecord {
  id: string;
  companyId: string;
  omsOrderId: string;
  currentAmount: string | number;
  currency: string;
  status: string;
  carrierCollectedAt?: string | null;
  carrierRemittedAt?: string | null;
  remittanceReference?: string | null;
  creditedToAccountAt?: string | null;
  createdAt: string;
  omsOrder?: {
    orderNumber: string;
    trackingNumber?: string | null;
    shippingProviderCode?: string | null;
    status: string;
  };
}

export interface RequestPayoutPayload {
  amount: number;
  bankName?: string;
  accountNumber?: string;
  iban?: string;
  notes?: string;
}

export const ClientFinancesService = {
  getAccount: async (): Promise<ClientFinancialAccount> => {
    return apiClient.get('/finances/account').then((r) => r.data);
  },

  getTransactions: async (params?: {
    type?: string;
    category?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: ClientFinancialTransaction[]; total: number; page: number; totalPages: number }> => {
    return apiClient.get('/finances/transactions', { params }).then((r) => r.data);
  },

  downloadTransactionsExport: async (params?: {
    type?: string;
    category?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    format?: 'xlsx' | 'csv';
  }): Promise<void> => {
    const format = params?.format ?? 'xlsx';
    const response = await apiClient.get<Blob>('/finances/transactions/export', {
      params: { ...params, format },
      responseType: 'blob',
    });
    const disposition = response.headers['content-disposition'] as string | undefined;
    const match = disposition?.match(/filename="([^"]+)"/);
    const filename =
      match?.[1] ??
      `financial-transactions-${new Date().toISOString().slice(0, 10)}.${format}`;
    const url = URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  getPayouts: async (params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: ClientPayoutRecord[]; total: number; page: number; totalPages: number }> => {
    return apiClient.get('/finances/payouts', { params }).then((r) => r.data);
  },

  requestPayout: async (payload: RequestPayoutPayload): Promise<ClientPayoutRecord> => {
    return apiClient.post('/finances/payouts', payload).then((r) => r.data);
  },

  getCod: async (params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: ClientCodRecord[]; total: number; page: number; totalPages: number }> => {
    return apiClient.get('/finances/cod', { params }).then((r) => r.data);
  },
};
