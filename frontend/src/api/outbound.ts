import { PageResult, api } from './client';
import type { OrderExecutionMode, OutboundExecutionPlan } from '../lib/execution-plan';

export type OutboundOrderStatus =
  | 'draft'
  | 'pending_approval'
  | 'pending_stock'
  | 'confirmed'
  | 'allocated'
  | 'picking'
  | 'packing'
  | 'ready_to_ship'
  | 'out_for_delivery'
  | 'shipped'
  | 'delivered'
  | 'returned'
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
  clientReference?: string | null;
  notes: string | null;
  requiresPacking: boolean;
  confirmedAt: string | null;
  shippedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  executionMode?: OrderExecutionMode | null;
  executionPlan?: OutboundExecutionPlan | null;
  lines?: OutboundOrderLine[];
  company?: { id: string; name: string };
  _count?: { lines: number };
}

export interface CreateOutboundOrderInput {
  companyId?: string;
  destinationAddress: string;
  requiredShipDate: string;
  carrier?: string;
  notes?: string;
  /** Default true when omitted. */
  requiresPacking?: boolean;
  executionMode?: OrderExecutionMode;
  executionPlan?: OutboundExecutionPlan;
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

export type QuickDirectedOutboundReasonCode =
  | 'consumption'
  | 'damage'
  | 'sample'
  | 'scrap'
  | 'other';

export interface QuickDirectedPickSlice {
  locationId: string;
  locationLabel: string;
  quantity: string;
  lotNumber: string | null;
}

export interface QuickDirectedOutboundResult {
  orderId: string;
  orderNumber: string;
  status: OutboundOrderStatus;
  product: {
    id: string;
    sku: string;
    name: string;
    barcode: string | null;
    uom: string;
  };
  totalQuantity: string;
  reasonCode: QuickDirectedOutboundReasonCode;
  directedPick: QuickDirectedPickSlice[];
  messageEn: string;
  messageAr: string;
}

export interface QuickDirectedOutboundInput {
  warehouseId: string;
  companyId?: string;
  productCode: string;
  quantity: number;
  reasonCode: QuickDirectedOutboundReasonCode;
}

export const OutboundApi = {
  async list(params: {
    warehouseId?: string;
    companyId?: string;
    status?: OutboundOrderStatus;
    orderSearch?: string;
    createdFrom?: string;
    createdTo?: string;
    quickDirectedOnly?: boolean;
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
    const headers = input.companyId ? { 'X-Company-Id': input.companyId } : undefined;
    const { data } = await api.post<OutboundOrder>('/outbound-orders', input, { headers });
    return data;
  },
  async updatePlan(
    id: string,
    body: {
      executionMode?: OrderExecutionMode;
      executionPlan?: OutboundExecutionPlan;
      requiredShipDate?: string;
      notes?: string;
      destinationAddress?: string;
      requiresPacking?: boolean;
    },
  ): Promise<OutboundOrder> {
    const { data } = await api.patch<OutboundOrder>(`/outbound-orders/${id}/plan`, body);
    return data;
  },
  async executeAdmin(id: string, companyIdOverride?: string): Promise<OutboundOrder> {
    const { data } = await api.post<OutboundOrder>(
      `/outbound-orders/${id}/execute-admin`,
      {},
      { headers: companyIdOverride ? { 'X-Company-Id': companyIdOverride } : undefined },
    );
    return data;
  },
  async confirm(id: string, body?: ConfirmOutboundBody, companyIdOverride?: string): Promise<OutboundOrder> {
    const { data } = await api.post<OutboundOrder>(`/outbound-orders/${id}/confirm`, body ?? {}, {
      headers: companyIdOverride ? { 'X-Company-Id': companyIdOverride } : undefined,
    });
    return data;
  },
  async cancel(id: string): Promise<OutboundOrder> {
    const { data } = await api.post<OutboundOrder>(`/outbound-orders/${id}/cancel`);
    return data;
  },
  async remove(id: string): Promise<{ id: string; deleted: boolean }> {
    const { data } = await api.delete<{ id: string; deleted: boolean }>(`/outbound-orders/${id}`);
    return data;
  },
  async quickDirected(input: QuickDirectedOutboundInput): Promise<QuickDirectedOutboundResult> {
    const headers = input.companyId ? { 'X-Company-Id': input.companyId } : undefined;
    const { data } = await api.post<QuickDirectedOutboundResult>(
      '/outbound-orders/quick-directed',
      input,
      { headers },
    );
    return data;
  },
};
