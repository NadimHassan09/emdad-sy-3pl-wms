import { PageResult, api } from './client';
import type { InboundExecutionPlan, OrderExecutionMode } from '../lib/execution-plan';

export type InboundOrderStatus =
  | 'draft'
  | 'pending_approval'
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
  discrepancyNotes?: string | null;
  lineNumber: number;
  product?: {
    id: string;
    sku: string;
    name: string;
    barcode?: string | null;
    trackingType: 'none' | 'lot' | 'package';
    uom: string;
    expiryTracking?: boolean;
    imagePath?: string | null;
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
  executionMode?: OrderExecutionMode | null;
  executionPlan?: InboundExecutionPlan | null;
  lines: InboundOrderLine[];
  company?: { id: string; name: string; logoUrl?: string | null };
  _count?: { lines: number };
}

export interface CreateInboundOrderInput {
  companyId?: string;
  expectedArrivalDate: string;
  notes?: string;
  executionMode?: OrderExecutionMode;
  executionPlan?: InboundExecutionPlan;
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

export interface ConfirmInboundBody {
  warehouseId?: string;
  stagingByLineId?: Record<string, string>;
}

export type InboundImportRowError = {
  rowNumber: number;
  externalReference: string | null;
  reason: string;
};

export type InboundImportValidateResult = {
  batchId: string;
  totalRows: number;
  orderCount: number;
  validOrders: number;
  invalidOrders: number;
  duplicateInFile: number;
  duplicateInDb: number;
  errors: InboundImportRowError[];
};

export type InboundImportExecuteResult = {
  batchId: string;
  imported: number;
  failed: number;
  skippedDuplicates: number;
  createdOrderNumbers: string[];
  errors: InboundImportRowError[];
};

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

  /** Downloads CSV for the current inbound list filters (server-side filtered). */
  async exportDownload(params: {
    warehouseId?: string;
    companyId?: string;
    orderSearch?: string;
    status?: InboundOrderStatus;
    createdFrom?: string;
    createdTo?: string;
  } = {}): Promise<void> {
    const response = await api.get<Blob>('/inbound-orders/export', {
      params,
      responseType: 'blob',
    });
    const disposition = response.headers['content-disposition'] as string | undefined;
    const match = disposition?.match(/filename="([^"]+)"/);
    const filename = match?.[1] ?? `inbound-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  },

    exportColumns(): Promise<Array<{ id: string; labelEn: string; labelAr: string }>> {
    return api
      .get<Array<{ id: string; labelEn: string; labelAr: string }>>('/inbound-orders/export/columns')
      .then((r) => r.data);
  },

  async exportDownloadPost(body: Record<string, unknown>): Promise<void> {
    const response = await api.post<Blob>('/inbound-orders/export', body, {
      responseType: 'blob',
    });
    const disposition = response.headers['content-disposition'] as string | undefined;
    const match = disposition?.match(/filename="([^"]+)"/);
    const filename = match?.[1] ?? `inbound-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  },

  async downloadImportTemplate(): Promise<void> {
    const response = await api.get<Blob>('/inbound-orders/import/template', {
      responseType: 'blob',
    });
    const disposition = response.headers['content-disposition'] as string | undefined;
    const match = disposition?.match(/filename="([^"]+)"/);
    const filename = match?.[1] ?? 'inbound-orders-import-template.csv';
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  },

  validateImport(file: File): Promise<any> {
    const body = new FormData();
    body.append('file', file);
    return api.post(`/inbound-orders/import/validate`, body).then((r) => r.data);
  },

  importOrders(file: File, companyId: string): Promise<any> {
    const body = new FormData();
    body.append('file', file);
    body.append('companyId', companyId);
    return api.post(`/inbound-orders/import`, body).then((r) => r.data);
  },

  async get(id: string): Promise<InboundOrder> {
    const { data } = await api.get<InboundOrder>(`/inbound-orders/${id}`);
    return data;
  },
  async create(input: CreateInboundOrderInput): Promise<InboundOrder> {
    const headers = input.companyId ? { 'X-Company-Id': input.companyId } : undefined;
    const { data } = await api.post<InboundOrder>('/inbound-orders', input, { headers });
    return data;
  },
  async updatePlan(
    id: string,
    body: {
      executionMode?: OrderExecutionMode;
      executionPlan?: InboundExecutionPlan;
      expectedArrivalDate?: string;
      notes?: string;
    },
  ): Promise<InboundOrder> {
    const { data } = await api.patch<InboundOrder>(`/inbound-orders/${id}/plan`, body);
    return data;
  },
  async approve(id: string, companyIdOverride?: string): Promise<InboundOrder> {
    const { data } = await api.post<InboundOrder>(
      `/inbound-orders/${id}/approve`,
      {},
      { headers: companyIdOverride ? { 'X-Company-Id': companyIdOverride } : undefined },
    );
    return data;
  },
  async completeReceiving(id: string, companyIdOverride?: string): Promise<InboundOrder> {
    const { data } = await api.post<InboundOrder>(
      `/inbound-orders/${id}/complete-receiving`,
      {},
      { headers: companyIdOverride ? { 'X-Company-Id': companyIdOverride } : undefined },
    );
    return data;
  },
  async completePutaway(id: string, companyIdOverride?: string): Promise<InboundOrder> {
    const { data } = await api.post<InboundOrder>(
      `/inbound-orders/${id}/complete-putaway`,
      {},
      { headers: companyIdOverride ? { 'X-Company-Id': companyIdOverride } : undefined },
    );
    return data;
  },
  /** @deprecated Prefer stage endpoints; backend advances one stage only. */
  async executeAdmin(id: string, companyIdOverride?: string): Promise<InboundOrder> {
    const { data } = await api.post<InboundOrder>(
      `/inbound-orders/${id}/execute-admin`,
      {},
      { headers: companyIdOverride ? { 'X-Company-Id': companyIdOverride } : undefined },
    );
    return data;
  },
  async confirm(id: string, body?: ConfirmInboundBody, companyIdOverride?: string): Promise<InboundOrder> {
    const { data } = await api.post<InboundOrder>(`/inbound-orders/${id}/confirm`, body ?? {}, {
      headers: companyIdOverride ? { 'X-Company-Id': companyIdOverride } : undefined,
    });
    return data;
  },
  async cancel(id: string): Promise<InboundOrder> {
    const { data } = await api.post<InboundOrder>(`/inbound-orders/${id}/cancel`);
    return data;
  },
  async remove(id: string): Promise<{ id: string; deleted: boolean }> {
    const { data } = await api.delete<{ id: string; deleted: boolean }>(`/inbound-orders/${id}`);
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
