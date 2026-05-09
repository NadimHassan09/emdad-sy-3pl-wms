import { apiClient } from './apiClient';

export interface ClientInboundOrderRow {
  id: string;
  orderNumber: string;
  status: string;
  expectedArrivalDate: string;
  createdAt: string;
  _count?: { lines: number };
}

export interface ClientInboundOrdersPage {
  items: ClientInboundOrderRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface ClientInboundOrderLine {
  id: string;
  lineNumber: number;
  expectedQuantity: string;
  receivedQuantity: string;
  expectedLotNumber: string | null;
  expectedExpiryDate: string | null;
  discrepancyType: string;
  qcStatus: string;
  product: {
    id: string;
    sku: string;
    name: string;
    barcode: string | null;
    status: string;
    trackingType: string;
    uom: string | null;
    expiryTracking: boolean;
  };
}

export interface ClientInboundOrderDetail {
  id: string;
  companyId: string;
  orderNumber: string;
  status: string;
  expectedArrivalDate: string;
  clientReference: string | null;
  notes: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  company: { id: string; name: string };
  lines: ClientInboundOrderLine[];
}

export async function fetchClientInboundOrders(params: {
  limit?: number;
  offset?: number;
  orderSearch?: string;
  status?: string;
}): Promise<ClientInboundOrdersPage> {
  const { data } = await apiClient.get<ClientInboundOrdersPage>('/inbound-orders', { params });
  return data;
}

export async function fetchClientInboundOrder(id: string): Promise<ClientInboundOrderDetail> {
  const { data } = await apiClient.get<ClientInboundOrderDetail>(`/inbound-orders/${id}`);
  return data;
}
