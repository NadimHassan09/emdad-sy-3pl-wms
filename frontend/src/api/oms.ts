import { PageResult, api } from './client';
import type { ShippingConfigPayload, ShippingMethod, ShippingPackageType, ShippingDeliveryType, ShippingPickupType, ShippingPayer } from './shipping';

export type OmsPaymentMethod = 'COD' | 'PREPAID' | 'CREDIT';
export type OmsCodStatus = 'pending' | 'collected' | 'remitted' | 'settled';
export type OmsAllocationStatus = 'none' | 'allocated' | 'released' | 'fulfilled';
export type OmsOrderStatus =
  | 'draft'
  | 'waiting_for_confirmation'
  | 'pending_approval'
  | 'confirmed_waiting_for_admin_approval'
  | 'pending'
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

export type CodRecordStatus = 'pending' | 'available' | 'paid_out' | 'returned';
export type CodGenerationStatus = 'none' | 'pending' | 'ok' | 'failed';

export type OmsImportRowError = {
  rowNumber: number;
  externalReference: string | null;
  reason: string;
};

export type OmsImportValidateResult = {
  batchId: string;
  totalRows: number;
  orderCount: number;
  validOrders: number;
  invalidOrders: number;
  duplicateInFile: number;
  duplicateInDb: number;
  errors: OmsImportRowError[];
};

export type OmsImportExecuteResult = {
  batchId: string;
  imported: number;
  failed: number;
  skippedDuplicates: number;
  createdOrderNumbers: string[];
  errors: OmsImportRowError[];
};

export interface CodRecordAdjustment {
  id: string;
  amount: string;
  reason: string | null;
  omsReturnId: string | null;
  createdAt: string;
  createdBy: string;
}

export interface CodRecord {
  id: string;
  companyId: string;
  company?: { id: string; name: string } | null;
  omsOrderId: string;
  omsOrder?: {
    id: string;
    orderNumber: string;
    status: string;
    recipientName: string | null;
    paymentMethod: string | null;
  } | null;
  originalAmount: string;
  currentAmount: string;
  currency: string;
  status: CodRecordStatus;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  availableAt: string | null;
  paidOutAt: string | null;
  adjustments: CodRecordAdjustment[];
}

export type OmsReturnStatus = 'requested' | 'approved' | 'rejected' | 'completed' | 'cancelled';

export interface OmsReturnLine {
  id: string;
  productId: string;
  quantity: string;
  unitPrice: string | null;
  lineTotal: string | null;
  lotId: string | null;
  lineNumber: number;
  product?: {
    id: string;
    sku: string;
    name: string;
    uom: string;
    trackingType: string;
    imagePath?: string | null;
  } | null;
}

export type OmsReturnAdminAction =
  | 'approve'
  | 'complete_receiving'
  | 'complete_putaway'
  | null;

export interface OmsReturnWarehouseLine {
  id: string;
  productId: string;
  expectedQuantity: string;
  receivedQuantity: string;
  postedQuantity: string;
  lineStatus: string;
  targetLocationId: string | null;
}

export interface OmsReturn {
  id: string;
  companyId: string;
  company?: { id: string; name: string } | null;
  omsOrderId: string;
  warehouseReturnId: string | null;
  returnNumber: string;
  status: OmsReturnStatus;
  reason: string | null;
  notes: string | null;
  rejectionReason: string | null;
  executionMode?: 'admin' | 'workers' | string | null;
  executionPlan?: import('../lib/execution-plan').InboundExecutionPlan | null;
  nextAdminAction?: OmsReturnAdminAction;
  createdBy: string;
  approvedBy: string | null;
  rejectedBy: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  omsOrder?: {
    id: string;
    orderNumber: string;
    status: string;
    outboundOrderId: string | null;
  } | null;
  warehouseReturn?: {
    id: string;
    orderNumber: string;
    status: string;
    warehouseId?: string | null;
    lines?: OmsReturnWarehouseLine[];
  } | null;
  lines: OmsReturnLine[];
}

export interface CreateOmsReturnLineInput {
  productId: string;
  quantity: number;
  unitPrice?: number;
  lotId?: string;
}

export interface CreateOmsReturnInput {
  omsOrderId: string;
  reason?: string;
  notes?: string;
  warehouseId?: string;
  lines: CreateOmsReturnLineInput[];
}

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
  recipientPhone?: string | null;
  city?: string | null;
  storeChannel?: string | null;
  total?: string | null;
  currency?: string | null;
  outboundOrderId?: string | null;
  needsInformation?: boolean;
  importBatchId?: string | null;
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
  codGenerationStatus?: CodGenerationStatus | null;
  submittedAt?: string | null;
  confirmedAt?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  rejectedAt?: string | null;
  rejectedBy?: string | null;
  rejectionReason?: string | null;
  externalReference?: string | null;
  warehouseStatus?: string | null;
  shippingMethod?: ShippingMethod | null;
  shippingProviderCode?: string | null;
  shippingReceiverLat?: string | number | null;
  shippingReceiverLng?: string | number | null;
  shippingPackageType?: ShippingPackageType | null;
  shippingContents?: string | null;
  shippingDeliveryType?: ShippingDeliveryType | null;
  shippingPickupType?: ShippingPickupType | null;
  shippingPayer?: ShippingPayer | null;
  shippingWeightKg?: string | number | null;
  shippingVolumeCbm?: string | number | null;
  shippingPhoneCountry?: string | null;
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
  /** Approved → out for delivery / shipped (awaiting completion). */
  pendingFulfillment?: number;
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
  codPendingAmount?: string;
  codCollectedAmount?: string;
  todaysRevenue?: string;
  trends?: {
    ordersToday?: number | null;
    pendingApproval?: number | null;
    pendingFulfillment?: number | null;
    deliveredToday?: number | null;
    returns?: number | null;
    todaysRevenue?: number | null;
  };
  ordersByStatus?: Array<{ status: string; count: number }>;
  ordersByChannel?: Array<{ channel: string; count: number }>;
  ordersPerDay?: Array<{
    day: string;
    count: number;
    revenue?: string;
    codPending?: string;
    codCollected?: string;
  }>;
  liveActivity?: Array<{
    id: string;
    eventType: string;
    createdAt: string;
    orderId?: string | null;
    orderNumber?: string | null;
    actorName?: string | null;
    payload?: unknown;
  }>;
  alerts?: Array<{ kind: string; message: string; count: number }>;
  recentOrders?: Array<{
    id: string;
    orderNumber: string;
    status: string;
    recipientName?: string | null;
    storeChannel?: string | null;
    paymentMethod?: string | null;
    codAmount?: string | null;
    subtotal?: string | null;
    currency?: string | null;
    createdAt: string;
    companyName?: string | null;
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

export interface CreateOmsOrderInput extends ShippingConfigPayload {
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

export interface UpdateOmsOrderInput extends ShippingConfigPayload {
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

export type OmsOrderStatusSummary = {
  total: number;
  byStatus: Record<string, number>;
  ordersByStatus: Array<{ status: string; count: number }>;
};

export const OmsApi = {
  dashboard(companyId?: string) {
    return api
      .get<OmsDashboardSummary>('/oms/dashboard', { params: { companyId } })
      .then((r) => r.data);
  },

  orderSummary(params: {
    createdFrom?: string;
    createdTo?: string;
    companyId?: string;
  } = {}) {
    return api
      .get<OmsOrderStatusSummary>('/oms/dashboard/order-summary', { params })
      .then((r) => r.data);
  },

  list(params: {
    companyId?: string;
    orderSearch?: string;
    orderId?: string;
    customer?: string;
    phone?: string;
    city?: string;
    totalOp?: 'eq' | 'gt' | 'gte' | 'lt' | 'lte';
    totalValue?: string;
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

  /** Downloads CSV for the current OMS list filters (server-side filtered). */
  async exportDownload(params: {
    companyId?: string;
    orderSearch?: string;
    orderId?: string;
    customer?: string;
    phone?: string;
    city?: string;
    totalOp?: 'eq' | 'gt' | 'gte' | 'lt' | 'lte';
    totalValue?: string;
    status?: OmsOrderStatus;
    storeChannel?: string;
    linkStatus?: 'linked' | 'unlinked';
    createdFrom?: string;
    createdTo?: string;
  } = {}): Promise<void> {
    const response = await api.get<Blob>('/oms/orders/export', {
      params,
      responseType: 'blob',
    });
    const disposition = response.headers['content-disposition'] as string | undefined;
    const match = disposition?.match(/filename="([^"]+)"/);
    const filename = match?.[1] ?? `oms-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  },

  async downloadImportTemplate(): Promise<void> {
    const response = await api.get<Blob>('/oms/orders/import/template', {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'oms-orders-import-template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  },

  validateImport(file: File): Promise<OmsImportValidateResult> {
    const body = new FormData();
    body.append('file', file);
    return api
      .post<OmsImportValidateResult>('/oms/orders/import/validate', body)
      .then((r) => r.data);
  },

  importOrders(file: File): Promise<OmsImportExecuteResult> {
    const body = new FormData();
    body.append('file', file);
    return api.post<OmsImportExecuteResult>('/oms/orders/import', body).then((r) => r.data);
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

  confirm(id: string) {
    return api.post<OmsOrderDetail>(`/oms/orders/${id}/confirm`).then((r) => r.data);
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

  recordExternalFulfillment(id: string) {
    return api
      .post<OmsOrderDetail>(`/oms/orders/${id}/external-fulfillment`)
      .then((r) => r.data);
  },

  delivered(id: string) {
    return api.post<OmsOrderDetail>(`/oms/orders/${id}/delivered`).then((r) => r.data);
  },

  revertDelivery(id: string, reason: string) {
    return api
      .post<OmsOrderDetail>(`/oms/orders/${id}/delivery-revert`, { reason })
      .then((r) => r.data);
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

  cancel(id: string) {
    return api.post<OmsOrderDetail>(`/oms/orders/${id}/cancel`).then((r) => r.data);
  },
};

export const CodApi = {
  list(params: {
    companyId?: string;
    status?: CodRecordStatus;
    omsOrderId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<PageResult<CodRecord>> {
    return api.get<PageResult<CodRecord>>('/cod/records', { params }).then((r) => r.data);
  },

  getRecord(id: string) {
    return api.get<CodRecord>(`/cod/records/${id}`).then((r) => r.data);
  },

  byOrder(omsOrderId: string) {
    return api.get<CodRecord | null>(`/cod/by-order/${omsOrderId}`).then((r) => r.data);
  },

  setStatus(id: string, status: CodRecordStatus) {
    return api.patch<CodRecord>(`/cod/records/${id}/status`, { status }).then((r) => r.data);
  },

  addAdjustment(id: string, input: { amount: number; reason?: string }) {
    return api.post<CodRecord>(`/cod/records/${id}/adjustments`, input).then((r) => r.data);
  },

  retryGeneration(omsOrderId: string) {
    return api.post<CodRecord>(`/cod/orders/${omsOrderId}/retry`).then((r) => r.data);
  },
};

export const OmsReturnsApi = {
  list(params: {
    companyId?: string;
    omsOrderId?: string;
    status?: OmsReturnStatus;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<PageResult<OmsReturn>> {
    return api.get<PageResult<OmsReturn>>('/oms/returns', { params }).then((r) => r.data);
  },

  get(id: string) {
    return api.get<OmsReturn>(`/oms/returns/${id}`).then((r) => r.data);
  },

  create(input: CreateOmsReturnInput) {
    return api.post<OmsReturn>('/oms/returns', input).then((r) => r.data);
  },

  approve(id: string, warehouseId?: string) {
    return api
      .post<OmsReturn>(`/oms/returns/${id}/approve`, { warehouseId })
      .then((r) => r.data);
  },

  updatePlan(
    id: string,
    input: {
      executionMode?: 'admin' | 'workers';
      executionPlan?: import('../lib/execution-plan').InboundExecutionPlan;
      notes?: string;
    },
  ) {
    return api.patch<OmsReturn>(`/oms/returns/${id}/plan`, input).then((r) => r.data);
  },

  completeReceiving(id: string) {
    return api
      .post<OmsReturn>(`/oms/returns/${id}/complete-receiving`)
      .then((r) => r.data);
  },

  completePutaway(id: string) {
    return api
      .post<OmsReturn>(`/oms/returns/${id}/complete-putaway`)
      .then((r) => r.data);
  },

  reject(id: string, reason?: string) {
    return api.post<OmsReturn>(`/oms/returns/${id}/reject`, { reason }).then((r) => r.data);
  },

  expressReturn(input: { omsOrderIds: string[]; reason?: string }) {
    return api.post<{
      created: Array<{ omsOrderId: string; orderNumber: string; returnId: string; returnNumber: string }>;
      failed: Array<{ omsOrderId: string; orderNumber?: string; error: string }>;
    }>('/oms/returns/express', input).then((r) => r.data);
  },

  validateForExpress(input: { omsOrderIds: string[] }) {
    return api.post<Array<{
      omsOrderId: string;
      orderNumber: string;
      eligible: boolean;
      error?: string;
      lines?: Array<{
        productId: string;
        productName: string;
        productSku: string;
        ordered: number;
        alreadyReturned: number;
        returnable: number;
      }>;
    }>>('/oms/returns/express/validate', input).then((r) => r.data);
  },
};
