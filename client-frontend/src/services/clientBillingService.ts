import { apiClient } from './apiClient';

export type ClientAccountStatus = 'active' | 'expiring' | 'restricted';

export type ClientBillingPlan = {
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

export type ClientBillingCycle = {
  id: string;
  companyId: string;
  billingPlanId: string;
  startsAt: string;
  endsAt: string;
  status: 'active' | 'renewed' | 'expired';
  rateSnapshot: unknown;
  createdAt: string;
  updatedAt: string;
};

export type ClientInvoiceLineType =
  | 'subscription'
  | 'inbound'
  | 'outbound'
  | 'packaging'
  | 'quality_check'
  | 'excess_volume'
  | 'excess_weight';

export type ClientInvoiceLine = {
  id: string;
  type: ClientInvoiceLineType;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
};

export type ClientInvoice = {
  id: string;
  companyId: string;
  billingCycleId: string;
  invoiceNumber: string;
  status: 'draft' | 'open' | 'paid' | 'cancelled';
  totalAmount: string;
  issuedAt: string | null;
  createdAt: string;
  updatedAt: string;
  billingCycle?: ClientBillingCycle;
  lines?: ClientInvoiceLine[];
};

export type ClientBillingSummary = {
  accountStatus: ClientAccountStatus;
  company: { id: string; name: string; status: string };
  plan: ClientBillingPlan | null;
  currentCycle: ClientBillingCycle | null;
  daysRemaining: number | null;
  reservedVolume: string | null;
  reservedWeight: string | null;
  currentInvoice: ClientInvoice | null;
};

export type ClientBillingAccess = {
  operationalAllowed: boolean;
  accountStatus: 'active' | 'expiring' | 'restricted' | 'no_plan';
  daysRemaining: number | null;
};

export async function fetchClientBillingAccess(): Promise<ClientBillingAccess> {
  const { data } = await apiClient.get<ClientBillingAccess>('/billing/access');
  return data;
}

export async function fetchClientBillingSummary(): Promise<ClientBillingSummary> {
  const { data } = await apiClient.get<ClientBillingSummary>('/billing/summary');
  return data;
}

export type ClientInvoicesPage = {
  items: ClientInvoice[];
  total: number;
  limit: number;
  offset: number;
};

export async function fetchClientInvoicesPage(params: {
  limit?: number;
  offset?: number;
  status?: string;
}): Promise<ClientInvoicesPage> {
  const { data } = await apiClient.get<ClientInvoicesPage>('/billing/invoices', { params });
  return data;
}

export async function fetchClientInvoices(): Promise<ClientInvoice[]> {
  const { data } = await apiClient.get<ClientInvoice[]>('/billing/invoices');
  return data;
}

export async function fetchClientInvoice(id: string): Promise<ClientInvoice> {
  const { data } = await apiClient.get<ClientInvoice>(`/billing/invoices/${id}`);
  return data;
}
