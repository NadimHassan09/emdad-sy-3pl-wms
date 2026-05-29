import { PageResult, api } from './client';

export type ReturnOrderStatus =
  | 'draft'
  | 'confirmed'
  | 'receiving'
  | 'inspecting'
  | 'completed'
  | 'cancelled';

export type ReturnLineStatus = 'pending' | 'received' | 'inspected' | 'posted';

export type ReturnItemCondition = 'new' | 'good' | 'damaged' | 'unusable';

export type ReturnItemDisposition =
  | 'restock'
  | 'quarantine'
  | 'scrap'
  | 'damaged'
  | 'discard'
  | 'inspection_required';

export interface ReturnOrderLine {
  id: string;
  returnOrderId: string;
  productId: string;
  outboundOrderLineId: string | null;
  packageId: string | null;
  lotId: string | null;
  expectedQuantity: string;
  receivedQuantity: string;
  postedQuantity: string;
  lineStatus: ReturnLineStatus;
  condition: ReturnItemCondition | null;
  disposition: ReturnItemDisposition | null;
  targetLocationId: string | null;
  inspectionNotes: string | null;
  inspectedAt: string | null;
  postedAt: string | null;
  lineNumber: number;
  product: {
    id: string;
    sku: string;
    name: string;
    barcode: string | null;
    trackingType: string;
    uom: string;
  };
  lot: { id: string; lotNumber: string } | null;
  outboundOrderLine: { id: string; lineNumber: number; pickedQuantity: string } | null;
  package: { id: string; packageCode: string } | null;
  targetLocation: { id: string; fullPath: string; type: string } | null;
}

export interface ReturnOrderListSummary {
  lineCount: number;
  productSummary: string;
  totalExpected: string;
  totalReceived: string;
  dispositionSummary: string | null;
}

export interface ReturnOrderListItem {
  id: string;
  companyId: string;
  orderNumber: string;
  status: ReturnOrderStatus;
  clientReference: string | null;
  shipmentReference: string | null;
  createdAt: string;
  completedAt: string | null;
  company: { id: string; name: string };
  originalOutbound: { id: string; orderNumber: string; status: string } | null;
  _count: { lines: number };
  summary: ReturnOrderListSummary;
}

export interface OutboundReturnQuotaLine {
  outboundOrderLineId: string;
  productId: string;
  sku: string;
  shippedQuantity: string;
  alreadyReturned: string;
  remaining: string;
}

export interface OutboundReturnQuota {
  outboundOrderId: string;
  orderNumber: string;
  status: string;
  lines: OutboundReturnQuotaLine[];
}

export interface ReturnOrder extends ReturnOrderListItem {
  warehouseId: string | null;
  notes: string | null;
  confirmedAt: string | null;
  receivingStartedAt: string | null;
  inspectingStartedAt: string | null;
  cancelledAt: string | null;
  warehouse: { id: string; code: string; name: string } | null;
  package: { id: string; packageCode: string; status: string } | null;
  lines: ReturnOrderLine[];
}

export interface ListReturnOrdersQuery {
  companyId?: string;
  status?: ReturnOrderStatus;
  originalOutboundOrderId?: string;
  orderSearch?: string;
  createdFrom?: string;
  createdTo?: string;
  limit?: number;
  offset?: number;
}

export interface CreateReturnOrderLineInput {
  productId: string;
  expectedQuantity: number;
  outboundOrderLineId?: string;
  packageId?: string;
  lotId?: string;
}

export interface CreateReturnOrderInput {
  companyId?: string;
  warehouseId?: string;
  originalOutboundOrderId?: string;
  packageId?: string;
  shipmentReference?: string;
  clientReference?: string;
  notes?: string;
  lines: CreateReturnOrderLineInput[];
}

export const ReturnsApi = {
  list(params: ListReturnOrdersQuery = {}) {
    return api
      .get<PageResult<ReturnOrderListItem>>('/return-orders', { params: { limit: 100, ...params } })
      .then((r) => r.data);
  },

  getOutboundQuota(outboundId: string, excludeReturnOrderId?: string) {
    return api
      .get<OutboundReturnQuota>(`/return-orders/outbound-quota/${outboundId}`, {
        params: excludeReturnOrderId ? { excludeReturnOrderId } : undefined,
      })
      .then((r) => r.data);
  },

  get(id: string) {
    return api.get<ReturnOrder>(`/return-orders/${id}`).then((r) => r.data);
  },

  create(body: CreateReturnOrderInput) {
    return api.post<ReturnOrder>('/return-orders', body).then((r) => r.data);
  },

  confirm(id: string) {
    return api.post<ReturnOrder>(`/return-orders/${id}/confirm`).then((r) => r.data);
  },

  startReceiving(id: string) {
    return api.post<ReturnOrder>(`/return-orders/${id}/start-receiving`).then((r) => r.data);
  },

  receiveLine(id: string, lineId: string, body: { quantity: number; condition?: ReturnItemCondition }) {
    return api
      .post<ReturnOrder>(`/return-orders/${id}/lines/${lineId}/receive`, body)
      .then((r) => r.data);
  },

  inspectLine(
    id: string,
    lineId: string,
    body: {
      condition: ReturnItemCondition;
      disposition?: ReturnItemDisposition;
      targetLocationId?: string;
      inspectionNotes?: string;
    },
  ) {
    return api
      .post<ReturnOrder>(`/return-orders/${id}/lines/${lineId}/inspect`, body)
      .then((r) => r.data);
  },

  applyDisposition(
    id: string,
    lineId: string,
    body: { disposition?: ReturnItemDisposition; targetLocationId?: string },
  ) {
    return api
      .post<ReturnOrder>(`/return-orders/${id}/lines/${lineId}/apply-disposition`, body)
      .then((r) => r.data);
  },

  postInventory(id: string) {
    return api.post<ReturnOrder>(`/return-orders/${id}/post-inventory`).then((r) => r.data);
  },

  complete(id: string) {
    return api.post<ReturnOrder>(`/return-orders/${id}/complete`).then((r) => r.data);
  },

  cancel(id: string) {
    return api.post<ReturnOrder>(`/return-orders/${id}/cancel`).then((r) => r.data);
  },
};
