import { apiClient } from './apiClient';

export type ClientOmsCodStatus = 'pending' | 'collected' | 'remitted' | 'settled';

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
  status: string;
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
  requiredShipDate: string;
  createdAt: string;
  outForDeliveryAt?: string | null;
  deliveredAt?: string | null;
  returnedAt?: string | null;
  shippedAt?: string | null;
  company: { id: string; name: string };
  lines: Array<{
    id: string;
    lineNumber: number;
    requestedQuantity: string;
    pickedQuantity: string;
    unitPrice?: string | null;
    lineTotal?: string | null;
    discountAmount?: string | null;
    status: string;
    product: { id: string; sku: string; name: string };
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
