import { apiClient } from './apiClient';

export interface ClientOutboundOrderRow {
  id: string;
  orderNumber: string;
  status: string;
  requiredShipDate: string;
  createdAt: string;
  _count?: { lines: number };
}

export interface ClientOutboundOrdersPage {
  items: ClientOutboundOrderRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface ClientOutboundOrderLine {
  id: string;
  lineNumber: number;
  requestedQuantity: string;
  pickedQuantity: string;
  status: string;
  product: {
    id: string;
    sku: string;
    name: string;
    barcode: string | null;
    status: string;
    trackingType: string;
    uom: string | null;
  };
}

export interface ClientOutboundOrderDetail {
  id: string;
  companyId: string;
  orderNumber: string;
  status: string;
  destinationAddress: string;
  requiredShipDate: string;
  carrier: string | null;
  trackingNumber: string | null;
  clientReference: string | null;
  notes: string | null;
  confirmedAt: string | null;
  pickingStartedAt: string | null;
  shippedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  company: { id: string; name: string };
  lines: ClientOutboundOrderLine[];
}

export async function fetchClientOutboundOrders(params: {
  limit?: number;
  offset?: number;
  orderSearch?: string;
  status?: string;
}): Promise<ClientOutboundOrdersPage> {
  const { data } = await apiClient.get<ClientOutboundOrdersPage>('/outbound-orders', { params });
  return data;
}

export async function fetchClientOutboundOrder(id: string): Promise<ClientOutboundOrderDetail> {
  const { data } = await apiClient.get<ClientOutboundOrderDetail>(`/outbound-orders/${id}`);
  return data;
}
