import { apiClient } from './apiClient';

export type ClientOmsCodStatus = 'pending' | 'collected' | 'remitted' | 'settled';

export type ClientOmsOrderStatus =
  | 'draft'
  | 'confirmed'
  | 'processing'
  | 'allocated'
  | 'ready_to_ship'
  | 'out_for_delivery'
  | 'shipped'
  | 'delivered'
  | 'returned'
  | 'cancelled';

export interface ClientOmsOrderListItem {
  id: string;
  orderNumber: string;
  status: ClientOmsOrderStatus;
  companyId: string;
  company?: { id: string; name: string } | null;
  recipientName?: string | null;
  storeChannel?: string | null;
  total?: string | null;
  currency?: string | null;
  outboundOrderId?: string | null;
  linkedOutboundOrder?: { id: string; orderNumber: string; status: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientOmsOrderPage {
  items: ClientOmsOrderListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ClientOmsOrderEvent {
  id: string;
  eventType: string;
  createdAt: string;
  payload?: Record<string, unknown> | null;
  creator?: { id: string; fullName: string } | null;
}

export interface ClientOmsOrderDetail {
  id: string;
  orderNumber: string;
  status: ClientOmsOrderStatus;
  destinationAddress: string;
  recipientName?: string | null;
  recipientPhone?: string | null;
  city?: string | null;
  district?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  deliveryInstructions?: string | null;
  paymentMethod?: string | null;
  subtotal?: string | null;
  shippingFee?: string | null;
  codAmount?: string | null;
  currency?: string | null;
  codStatus?: ClientOmsCodStatus | null;
  codCollectedAt?: string | null;
  codRemittedAt?: string | null;
  allocationStatus?: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  clientReference?: string | null;
  notes?: string | null;
  storeChannel?: string | null;
  requiredShipDate: string;
  createdAt: string;
  outForDeliveryAt?: string | null;
  deliveredAt?: string | null;
  returnedAt?: string | null;
  company?: { id: string; name: string } | null;
  linkedOutboundOrder?: { id: string; orderNumber: string; status: string } | null;
  warehouseStatus?: string | null;
  lines: Array<{
    id: string;
    lineNumber: number;
    requestedQuantity: string;
    unitPrice?: string | null;
    lineTotal?: string | null;
    discountAmount?: string | null;
    product?: { id: string; sku: string; name: string };
  }>;
  timeline?: ClientOmsOrderEvent[];
}

export interface ClientCodReportRow {
  id: string;
  orderNumber: string;
  status: string;
  recipientName: string | null;
  codAmount: string | null;
  codStatus: ClientOmsCodStatus | null;
  codCollectedAt: string | null;
  codRemittedAt: string | null;
  currency: string | null;
  createdAt: string;
  deliveredAt: string | null;
}

export interface ClientCodReportPage {
  items: ClientCodReportRow[];
  total: number;
  limit: number;
  offset: number;
  summary: { orderCount: number; totalCodAmount: string };
}

export async function fetchClientOmsOrders(params: {
  limit?: number;
  offset?: number;
  orderSearch?: string;
  status?: ClientOmsOrderStatus;
  storeChannel?: string;
  createdFrom?: string;
  createdTo?: string;
}): Promise<ClientOmsOrderPage> {
  const { data } = await apiClient.get<ClientOmsOrderPage>('/oms/orders', { params });
  return data;
}

export async function fetchClientOmsOrder(id: string): Promise<ClientOmsOrderDetail> {
  const { data } = await apiClient.get<ClientOmsOrderDetail>(`/oms/orders/${id}`);
  return data;
}

export async function fetchClientOmsTimeline(id: string): Promise<ClientOmsOrderEvent[]> {
  const { data } = await apiClient.get<ClientOmsOrderEvent[]>(`/oms/orders/${id}/timeline`);
  return data;
}

export async function fetchClientCodReport(params: {
  limit?: number;
  offset?: number;
  codStatus?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<ClientCodReportPage> {
  const { data } = await apiClient.get<ClientCodReportPage>('/oms/cod-report', { params });
  return data;
}
