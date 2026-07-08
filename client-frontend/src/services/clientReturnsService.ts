import { apiClient } from './apiClient';

export interface ClientReturnOrderRow {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
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
