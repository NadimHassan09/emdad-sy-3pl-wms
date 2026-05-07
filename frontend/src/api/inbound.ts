import { PageResult, api } from './client';

export type InboundOrderStatus =
  | 'draft'
  | 'confirmed'
  | 'in_progress'
  | 'partially_received'
  | 'completed'
  | 'cancelled';

export interface InboundOrderLine {
  id: string;
  inboundOrderId: string;
  productId: string;
  expectedQuantity: string;
  receivedQuantity: string;
  expectedLotNumber: string | null;
  expectedExpiryDate: string | null;
  lineNumber: number;
  product?: {
    id: string;
    sku: string;
    name: string;
    barcode?: string | null;
    trackingType: 'none' | 'lot' | 'package';
    uom: string;
    expiryTracking?: boolean;
  };
}

export interface InboundOrder {
  id: string;
  companyId: string;
  orderNumber: string;
  status: InboundOrderStatus;
  expectedArrivalDate: string;
  notes: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  lines: InboundOrderLine[];
  company?: { id: string; name: string };
  _count?: { lines: number };
}

export interface CreateInboundOrderInput {
  companyId?: string;
  expectedArrivalDate: string;
  notes?: string;
  lines: Array<{
    productId: string;
    expectedQuantity: number;
    expectedLotNumber?: string;
    expectedExpiryDate?: string;
  }>;
}

export interface ReceiveLineInput {
  quantity: number;
  locationId: string;
  lotNumber?: string;
  expiryDate?: string;
  overrideLot?: boolean;
}

/** Optional body; required fields when backend `TASK_ONLY_FLOWS=true`. */
export interface ConfirmInboundBody {
  warehouseId?: string;
  stagingByLineId?: Record<string, string>;
}

export const InboundApi = {
  async list(params: {
    warehouseId?: string;
    companyId?: string;
    status?: InboundOrderStatus;
    orderSearch?: string;
    createdFrom?: string;
    createdTo?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<PageResult<InboundOrder>> {
    const { data } = await api.get<PageResult<InboundOrder>>('/inbound-orders', {
      params: { limit: 200, ...params },
    });
    return data;
  },
  async get(id: string): Promise<InboundOrder> {
    const { data } = await api.get<InboundOrder>(`/inbound-orders/${id}`);
    return data;
  },
  async create(input: CreateInboundOrderInput): Promise<InboundOrder> {
    const { data } = await api.post<InboundOrder>('/inbound-orders', input);
    return data;
  },
  async confirm(id: string, body?: ConfirmInboundBody): Promise<InboundOrder> {
    const { data } = await api.post<InboundOrder>(`/inbound-orders/${id}/confirm`, body ?? {});
    return data;
  },
  async cancel(id: string): Promise<InboundOrder> {
    const { data } = await api.post<InboundOrder>(`/inbound-orders/${id}/cancel`);
    return data;
  },
  async receive(orderId: string, lineId: string, input: ReceiveLineInput): Promise<InboundOrder> {
    const { data } = await api.post<InboundOrder>(
      `/inbound-orders/${orderId}/lines/${lineId}/receive`,
      input,
    );
    return data;
  },
};
