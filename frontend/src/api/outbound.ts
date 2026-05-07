import { PageResult, api } from './client';

export type OutboundOrderStatus =
  | 'draft'
  | 'pending_stock'
  | 'confirmed'
  | 'picking'
  | 'packing'
  | 'ready_to_ship'
  | 'shipped'
  | 'cancelled';

export interface OutboundOrderLine {
  id: string;
  outboundOrderId: string;
  productId: string;
  requestedQuantity: string;
  pickedQuantity: string;
  specificLotId: string | null;
  status: 'pending' | 'picking' | 'done' | 'short' | 'cancelled';
  lineNumber: number;
  product?: {
    id: string;
    sku: string;
    name: string;
    barcode?: string | null;
    trackingType: 'none' | 'lot' | 'package';
    uom: string;
  };
}

export interface OutboundOrder {
  id: string;
  companyId: string;
  orderNumber: string;
  status: OutboundOrderStatus;
  destinationAddress: string;
  requiredShipDate: string;
  carrier: string | null;
  trackingNumber: string | null;
  notes: string | null;
  confirmedAt: string | null;
  shippedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  lines: OutboundOrderLine[];
  company?: { id: string; name: string };
  _count?: { lines: number };
}

export interface CreateOutboundOrderInput {
  companyId?: string;
  destinationAddress: string;
  requiredShipDate: string;
  carrier?: string;
  notes?: string;
  lines: Array<{
    productId: string;
    requestedQuantity: number;
    specificLotId?: string;
  }>;
}

/** Optional body; `warehouseId` required when backend `TASK_ONLY_FLOWS=true`. */
export interface ConfirmOutboundBody {
  warehouseId?: string;
}

export const OutboundApi = {
  async list(params: {
    warehouseId?: string;
    companyId?: string;
    status?: OutboundOrderStatus;
    orderSearch?: string;
    createdFrom?: string;
    createdTo?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<PageResult<OutboundOrder>> {
    const { data } = await api.get<PageResult<OutboundOrder>>('/outbound-orders', {
      params: { limit: 200, ...params },
    });
    return data;
  },
  async get(id: string): Promise<OutboundOrder> {
    const { data } = await api.get<OutboundOrder>(`/outbound-orders/${id}`);
    return data;
  },
  async create(input: CreateOutboundOrderInput): Promise<OutboundOrder> {
    const { data } = await api.post<OutboundOrder>('/outbound-orders', input);
    return data;
  },
  async confirm(id: string, body?: ConfirmOutboundBody): Promise<OutboundOrder> {
    const { data } = await api.post<OutboundOrder>(`/outbound-orders/${id}/confirm`, body ?? {});
    return data;
  },
  async cancel(id: string): Promise<OutboundOrder> {
    const { data } = await api.post<OutboundOrder>(`/outbound-orders/${id}/cancel`);
    return data;
  },
};
