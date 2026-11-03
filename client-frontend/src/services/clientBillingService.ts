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
  outboundBaseFee?: string;
  outboundIncludedItems?: number;
  outboundAdditionalItemFee?: string;
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
  | 'excess_weight'
  | 'manual'
  | 'order_charge'
  | 'fulfillment_inbound'
  | 'fulfillment_outbound'
  | 'fulfillment_oms'
  | 'emdad_shipping'
  | 'storage_fee';

export type ClientInvoiceLine = {
  id: string;
  type: ClientInvoiceLineType;
  lineSource?: 'system' | 'manual' | 'order';
  description?: string | null;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
};

export type ClientInvoice = {
  id: string;
  companyId: string;
  billingCycleId: string | null;
  invoiceSource?: 'cycle' | 'ad_hoc';
  invoiceNumber: string;
  status: 'draft' | 'unpaid' | 'paid' | 'cancelled' | 'open' | 'overdue';
  subtotalAmount?: string;
  discountAmount?: string;
  vatAmount?: string;
  vatPercentage?: string;
  grandTotal?: string;
  totalAmount: string;
  dueDate?: string | null;
  issuedAt: string | null;
  createdAt: string;
  updatedAt: string;
  billingCycle?: ClientBillingCycle | null;
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
  statusCounts?: Record<string, number>;
};

export async function fetchClientInvoicesPage(params: {
  limit?: number;
  offset?: number;
  status?: string;
}): Promise<ClientInvoicesPage> {
  const { data } = await apiClient.get<ClientInvoicesPage>('/billing/invoices', { params });
  return data;
}

export async function downloadClientInvoicesExcel(status?: string): Promise<void> {
  const params: Record<string, string> = {};
  if (status) params.status = status;
  const res = await apiClient.get('/billing/invoices/export', {
    params,
    responseType: 'blob',
  });
  const blob = new Blob([res.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `client-invoices-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function fetchClientInvoices(): Promise<ClientInvoice[]> {
  const { data } = await apiClient.get<ClientInvoice[]>('/billing/invoices');
  return data;
}

export async function fetchClientInvoice(id: string): Promise<ClientInvoice> {
  const { data } = await apiClient.get<ClientInvoice>(`/billing/invoices/${id}`);
  return data;
}

export type ClientInvoiceBreakdown = {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  period: { from: string | null; to: string | null };
  total: string;
  sections: Array<{
    kind: 'inbound' | 'outbound' | 'oms';
    orderCount: number;
    statusCounts: Record<string, number>;
    billed: boolean;
    fulfillmentTotal: string | null;
    shippingTotal: string | null;
    orders: Array<{
      orderNumber: string;
      status: string;
      linesCount: number;
      weightKg: string;
      charged: boolean;
      fulfillmentFee: string | null;
      shippingFee: string | null;
      shippingFeeAlreadySettled: boolean;
    }>;
  }>;
  statement: { balanceBefore: string; deducted: string; balanceAfter: string | null; remainingDue: string } | null;
};

export async function fetchClientInvoiceBreakdown(id: string): Promise<ClientInvoiceBreakdown> {
  const { data } = await apiClient.get<ClientInvoiceBreakdown>(`/billing/invoices/${id}/breakdown`);
  return data;
}
