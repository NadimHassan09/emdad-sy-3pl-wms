import { api } from './client';
import type { OutboundOrder } from './outbound';

export type OmsPaymentMethod = 'COD' | 'PREPAID' | 'CREDIT';
export type OmsCodStatus = 'pending' | 'collected' | 'remitted' | 'settled';
export type OmsAllocationStatus = 'none' | 'allocated' | 'released' | 'fulfilled';

export interface OmsOrderDetail extends OutboundOrder {
  recipientName?: string | null;
  recipientPhone?: string | null;
  city?: string | null;
  district?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  deliveryInstructions?: string | null;
  paymentMethod?: OmsPaymentMethod | null;
  subtotal?: string | null;
  shippingFee?: string | null;
  codAmount?: string | null;
  currency?: string | null;
  codStatus?: OmsCodStatus | null;
  codCollectedAt?: string | null;
  codRemittedAt?: string | null;
  allocationStatus?: OmsAllocationStatus;
  allocatedAt?: string | null;
  outForDeliveryAt?: string | null;
  deliveredAt?: string | null;
  returnedAt?: string | null;
  timeline?: OmsOrderEvent[];
  reservations?: OmsStockReservation[];
}

export interface OmsOrderEvent {
  id: string;
  eventType: string;
  payload?: Record<string, unknown> | null;
  createdAt: string;
  creator?: { id: string; fullName: string } | null;
}

export interface OmsStockReservation {
  id: string;
  productId: string;
  locationId: string;
  lotId: string | null;
  quantity: string;
  status: string;
}

export interface OmsDashboardSummary {
  ordersToday: number;
  pendingOrders: number;
  allocatedOrders: number;
  picking: number;
  packing: number;
  outForDelivery: number;
  deliveredToday: number;
  codPending: number;
  codCollected: number;
  codSettled: number;
  returns: number;
}

export const OmsApi = {
  dashboard(companyId?: string) {
    return api
      .get<OmsDashboardSummary>('/oms/dashboard', { params: { companyId } })
      .then((r) => r.data);
  },

  getOrder(id: string) {
    return api.get<OmsOrderDetail>(`/oms/orders/${id}`).then((r) => r.data);
  },

  timeline(id: string) {
    return api.get<OmsOrderEvent[]>(`/oms/orders/${id}/timeline`).then((r) => r.data);
  },

  allocate(id: string, warehouseId?: string) {
    return api
      .post<OmsOrderDetail>(`/oms/orders/${id}/allocate`, { warehouseId })
      .then((r) => r.data);
  },

  releaseAllocation(id: string) {
    return api.post<OmsOrderDetail>(`/oms/orders/${id}/release-allocation`).then((r) => r.data);
  },

  outForDelivery(id: string) {
    return api.post<OmsOrderDetail>(`/oms/orders/${id}/out-for-delivery`).then((r) => r.data);
  },

  delivered(id: string) {
    return api.post<OmsOrderDetail>(`/oms/orders/${id}/delivered`).then((r) => r.data);
  },

  returned(id: string) {
    return api.post<OmsOrderDetail>(`/oms/orders/${id}/returned`).then((r) => r.data);
  },

  collectCod(id: string) {
    return api.post<OmsOrderDetail>(`/oms/orders/${id}/cod/collect`).then((r) => r.data);
  },

  settleCod(id: string) {
    return api.post<OmsOrderDetail>(`/oms/orders/${id}/cod/settle`).then((r) => r.data);
  },
};
