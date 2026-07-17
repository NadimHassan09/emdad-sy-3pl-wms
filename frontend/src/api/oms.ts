import { PageResult, api } from './client';

export type OmsPaymentMethod = 'COD' | 'PREPAID' | 'CREDIT';
export type OmsCodStatus = 'pending' | 'collected' | 'remitted' | 'settled';
export type OmsAllocationStatus = 'none' | 'allocated' | 'released' | 'fulfilled';
export type OmsOrderStatus =
  | 'draft'
  | 'pending_approval'
  | 'rejected'
  | 'approved'
  | 'confirmed'
  | 'processing'
  | 'allocated'
  | 'picking'
  | 'packing'
  | 'ready_to_ship'
  | 'out_for_delivery'
  | 'shipped'
  | 'delivered'
  | 'failed_delivery'
  | 'completed'
  | 'returned'
  | 'cancelled';

export interface OmsOrderLine {
  id: string;
  productId: string;
  requestedQuantity: string;
  specificLotId: string | null;
  lineNumber: number;
  unitPrice?: string | null;
  lineTotal?: string | null;
  discountAmount?: string | null;
  product?: {
    id: string;
    sku: string;
    name: string;
    barcode?: string | null;
    status: string;
    trackingType: string;
    uom: string;
  };
}

export interface LinkedOutboundSummary {
  id: string;
  orderNumber: string;
  status: string;
}

export interface OmsOrderListItem {
  id: string;
  orderNumber: string;
  status: OmsOrderStatus;
  companyId: string;
  company?: { id: string; name: string } | null;
  recipientName?: string | null;
  storeChannel?: string | null;
  total?: string | null;
  currency?: string | null;
  outboundOrderId?: string | null;
  linkedOutboundOrder?: LinkedOutboundSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface OmsOrderDetail extends OmsOrderListItem {
  destinationAddress: string;
  requiredShipDate: string;
  carrier?: string | null;
  trackingNumber?: string | null;
  clientReference?: string | null;
  notes?: string | null;
  requiresPacking: boolean;
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
  codStatus?: OmsCodStatus | null;
  codCollectedAt?: string | null;
  codRemittedAt?: string | null;
  allocationStatus?: OmsAllocationStatus;
  allocatedAt?: string | null;
  outForDeliveryAt?: string | null;
  deliveredAt?: string | null;
  returnedAt?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  rejectedAt?: string | null;
  rejectedBy?: string | null;
  rejectionReason?: string | null;
  externalReference?: string | null;
  warehouseStatus?: string | null;
  lines: OmsOrderLine[];
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
  totalOrders?: number;
  ordersToday: number;
  pendingOrders: number;
  pendingApproval?: number;
  approved?: number;
  allocatedOrders: number;
  picking: number;
  packing: number;
  outForDelivery: number;
  deliveredToday: number;
  cancelled?: number;
  returns: number;
  codPending: number;
  codCollected: number;
  codSettled: number;
  todaysRevenue?: string;
  ordersByStatus?: Array<{ status: string; count: number }>;
  ordersByChannel?: Array<{ channel: string; count: number }>;
  ordersPerDay?: Array<{ day: string; count: number }>;
  recentOrders?: Array<{
    id: string;
    orderNumber: string;
    status: string;
    recipientName?: string | null;
    storeChannel?: string | null;
    subtotal?: string | null;
    currency?: string | null;
    createdAt: string;
  }>;
}

export interface CreateOmsOrderLineInput {
  productId: string;
  requestedQuantity: number;
  specificLotId?: string;
  unitPrice?: number;
  lineTotal?: number;
  discountAmount?: number;
}

export interface CreateOmsOrderInput {
  companyId?: string;
  destinationAddress?: string;
  requiredShipDate: string;
  carrier?: string;
  clientReference?: string;
  notes?: string;
  requiresPacking?: boolean;
  recipientName?: string;
  recipientPhone?: string;
  city?: string;
  district?: string;
  addressLine1?: string;
  addressLine2?: string;
  deliveryInstructions?: string;
  paymentMethod?: OmsPaymentMethod;
  subtotal?: number;
  shippingFee?: number;
  codAmount?: number;
  currency?: string;
  warehouseId?: string;
  outboundOrderId?: string;
  storeChannel?: string;
  externalReference?: string;
  lines: CreateOmsOrderLineInput[];
}

export interface UpdateOmsOrderInput {
  recipientName?: string;
  recipientPhone?: string;
  city?: string;
  district?: string;
  addressLine1?: string;
  addressLine2?: string;
  deliveryInstructions?: string;
  destinationAddress?: string;
  requiredShipDate?: string;
  carrier?: string;
  trackingNumber?: string;
  notes?: string;
  clientReference?: string;
  paymentMethod?: OmsPaymentMethod;
  subtotal?: number;
  shippingFee?: number;
  codAmount?: number;
  currency?: string;
  outboundOrderId?: string | null;
  storeChannel?: string;
  externalReference?: string;
}

export const OmsApi = {
  dashboard(companyId?: string) {
    return api
      .get<OmsDashboardSummary>('/oms/dashboard', { params: { companyId } })
      .then((r) => r.data);
  },

  list(params: {
    companyId?: string;
    orderSearch?: string;
    status?: OmsOrderStatus;
    storeChannel?: string;
    linkStatus?: 'linked' | 'unlinked';
    createdFrom?: string;
    createdTo?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<PageResult<OmsOrderListItem>> {
    return api.get<PageResult<OmsOrderListItem>>('/oms/orders', { params }).then((r) => r.data);
  },

  create(input: CreateOmsOrderInput) {
    const headers = input.companyId ? { 'X-Company-Id': input.companyId } : undefined;
    return api.post<OmsOrderDetail>('/oms/orders', input, { headers }).then((r) => r.data);
  },

  getOrder(id: string) {
    return api.get<OmsOrderDetail>(`/oms/orders/${id}`).then((r) => r.data);
  },

  update(id: string, input: UpdateOmsOrderInput) {
    return api.patch<OmsOrderDetail>(`/oms/orders/${id}`, input).then((r) => r.data);
  },

  delete(id: string) {
    return api.delete<{ ok: boolean }>(`/oms/orders/${id}`).then((r) => r.data);
  },

  approve(id: string, shippingFee?: number) {
    return api
      .post<OmsOrderDetail>(`/oms/orders/${id}/approve`, { shippingFee })
      .then((r) => r.data);
  },

  reject(id: string, reason?: string) {
    return api
      .post<OmsOrderDetail>(`/oms/orders/${id}/reject`, { reason })
      .then((r) => r.data);
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

  failedDelivery(id: string) {
    return api.post<OmsOrderDetail>(`/oms/orders/${id}/failed-delivery`).then((r) => r.data);
  },

  complete(id: string) {
    return api.post<OmsOrderDetail>(`/oms/orders/${id}/complete`).then((r) => r.data);
  },

  collectCod(id: string) {
    return api.post<OmsOrderDetail>(`/oms/orders/${id}/cod/collect`).then((r) => r.data);
  },

  settleCod(id: string) {
    return api.post<OmsOrderDetail>(`/oms/orders/${id}/cod/settle`).then((r) => r.data);
  },
};
