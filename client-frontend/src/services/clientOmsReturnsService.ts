import { apiClient } from './apiClient';

export type ClientOmsReturnStatus =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface ClientOmsReturnRow {
  id: string;
  returnNumber: string;
  status: ClientOmsReturnStatus | string;
  reason?: string | null;
  notes?: string | null;
  createdAt: string;
  omsOrderId: string;
  omsOrder?: {
    id: string;
    orderNumber: string;
    status: string;
    outboundOrderId?: string | null;
  } | null;
  warehouseReturn?: {
    id: string;
    orderNumber: string;
    status: string;
  } | null;
  company?: { id: string; name: string } | null;
  lines?: Array<{
    id: string;
    productId: string;
    quantity: string;
    unitPrice?: string | null;
    lineTotal?: string | null;
    lotId?: string | null;
    lineNumber: number;
    product?: {
      id: string;
      sku: string;
      name: string;
      uom?: string;
      trackingType?: string;
    } | null;
  }>;
}

export interface ClientOmsReturnsPage {
  items: ClientOmsReturnRow[];
  total: number;
  limit: number;
  offset: number;
}

export type CreateClientOmsReturnInput = {
  omsOrderId: string;
  reason?: string;
  notes?: string;
  lines: Array<{
    productId: string;
    quantity: number;
    lotId?: string;
  }>;
};

export async function fetchClientOmsReturns(params: {
  limit?: number;
  offset?: number;
  status?: string;
  omsOrderId?: string;
}): Promise<ClientOmsReturnsPage> {
  const { data } = await apiClient.get<ClientOmsReturnsPage>('/oms/returns', { params });
  return data;
}

export async function fetchClientOmsReturn(id: string): Promise<ClientOmsReturnRow> {
  const { data } = await apiClient.get<ClientOmsReturnRow>(`/oms/returns/${id}`);
  return data;
}

export async function createClientOmsReturn(
  input: CreateClientOmsReturnInput,
): Promise<ClientOmsReturnRow> {
  const { data } = await apiClient.post<ClientOmsReturnRow>('/oms/returns', input);
  return data;
}
