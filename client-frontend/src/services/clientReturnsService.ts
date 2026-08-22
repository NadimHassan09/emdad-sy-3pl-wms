import { apiClient } from './apiClient';

export interface ClientReturnOrderRow {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  clientReference?: string | null;
  company?: { id: string; name: string };
  originalOutbound?: { id: string; orderNumber: string; status: string } | null;
  _count?: { lines: number };
}

export interface ClientReturnOrdersPage {
  items: ClientReturnOrderRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface ClientReturnOrderDetail extends ClientReturnOrderRow {
  clientReference?: string | null;
  notes?: string | null;
  lines: Array<{
    id: string;
    lineNumber: number;
    expectedQuantity: string;
    receivedQuantity: string;
    lineStatus: string;
    product: { id: string; sku: string; name: string };
  }>;
}

export type CreateClientReturnLine = {
  productId: string;
  expectedQuantity: number;
  outboundOrderLineId?: string;
};

export type CreateClientReturnInput = {
  originalOutboundOrderId?: string;
  clientReference?: string;
  notes?: string;
  lines: CreateClientReturnLine[];
};

export async function fetchClientReturns(params: {
  limit?: number;
  offset?: number;
  status?: string;
  source?: 'oms' | 'outbound';
}): Promise<ClientReturnOrdersPage> {
  const { data } = await apiClient.get<ClientReturnOrdersPage>('/returns', { params });
  return data;
}

export async function fetchClientReturn(id: string): Promise<ClientReturnOrderDetail> {
  const { data } = await apiClient.get<ClientReturnOrderDetail>(`/returns/${id}`);
  return data;
}

export async function createClientReturn(input: CreateClientReturnInput): Promise<ClientReturnOrderRow> {
  const { data } = await apiClient.post<ClientReturnOrderRow>('/returns', input);
  return data;
}

export interface ClientOutboundReturnQuotaLine {
  outboundOrderLineId: string;
  productId: string;
  sku: string;
  shippedQuantity: string;
  alreadyReturned: string;
  remaining: string;
}

export interface ClientOutboundReturnQuota {
  outboundOrderId: string;
  orderNumber: string;
  status: string;
  lines: ClientOutboundReturnQuotaLine[];
}

export async function fetchClientOutboundReturnQuota(
  outboundId: string,
): Promise<ClientOutboundReturnQuota> {
  const { data } = await apiClient.get<ClientOutboundReturnQuota>(
    `/returns/outbound-quota/${outboundId}`,
  );
  return data;
}
