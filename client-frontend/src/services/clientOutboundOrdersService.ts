import { apiClient } from './apiClient';

export interface ClientOutboundOrderRow {
  id: string;
  orderNumber: string;
  status: string;
  requiredShipDate: string;
  createdAt: string;
  recipientName?: string | null;
  city?: string | null;
  paymentMethod?: string | null;
  codAmount?: string | null;
  codStatus?: string | null;
  allocationStatus?: string | null;
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
    imagePath?: string | null;
    imageUrl?: string | null;
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
  createdFrom?: string;
  createdTo?: string;
}): Promise<ClientOutboundOrdersPage> {
  const { data } = await apiClient.get<ClientOutboundOrdersPage>('/outbound-orders', { params });
  return data;
}

export async function fetchClientOutboundOrder(id: string): Promise<ClientOutboundOrderDetail> {
  const { data } = await apiClient.get<ClientOutboundOrderDetail>(`/outbound-orders/${id}`);
  return data;
}

export type CreateClientOutboundOrderLine = {
  productId: string;
  requestedQuantity: number;
  specificLotId?: string;
};

export type CreateClientOutboundOrderInput = {
  destinationAddress: string;
  requiredShipDate: string;
  carrier?: string;
  clientReference?: string;
  notes?: string;
  lines: CreateClientOutboundOrderLine[];
};

export async function createClientOutboundOrder(
  input: CreateClientOutboundOrderInput,
): Promise<ClientOutboundOrderRow> {
  const { data } = await apiClient.post<ClientOutboundOrderRow>('/outbound-orders', input);
  return data;
}

export type UpdateClientOutboundOrderInput = {
  destinationAddress?: string;
  requiredShipDate?: string;
  clientReference?: string;
  notes?: string;
};

export async function updateClientOutboundOrder(
  id: string,
  input: UpdateClientOutboundOrderInput,
): Promise<ClientOutboundOrderDetail> {
  const { data } = await apiClient.patch<ClientOutboundOrderDetail>(`/outbound-orders/${id}`, input);
  return data;
}

export async function deleteClientOutboundOrder(id: string): Promise<{ id: string; deleted: true }> {
  const { data } = await apiClient.delete<{ id: string; deleted: true }>(`/outbound-orders/${id}`);
  return data;
}
