import { apiClient } from './apiClient';

export type ClientOmsReturnStatus =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface ClientOmsReturnRow {
  id: string;
  returnNumber: string;
  status: ClientOmsReturnStatus | string;
  reason?: string | null;
  notes?: string | null;
  createdAt: string;
  omsOrderId: string;
  omsOrder?: {
    id: string;
    orderNumber: string;
    status: string;
    outboundOrderId?: string | null;
  } | null;
  warehouseReturn?: {
    id: string;
    orderNumber: string;
    status: string;
  } | null;
  company?: { id: string; name: string } | null;
  lines?: Array<{
    id: string;
    productId: string;
    quantity: string;
    unitPrice?: string | null;
    lineTotal?: string | null;
    lotId?: string | null;
    lineNumber: number;
    product?: {
      id: string;
      sku: string;
      name: string;
      uom?: string;
      trackingType?: string;
    } | null;
  }>;
}

export interface ClientOmsReturnsPage {
  items: ClientOmsReturnRow[];
  total: number;
  limit: number;
  offset: number;
}

export type CreateClientOmsReturnInput = {
  omsOrderId: string;
  reason?: string;
  notes?: string;
  lines: Array<{
    productId: string;
    quantity: number;
    lotId?: string;
  }>;
};

export async function fetchClientOmsReturns(params: {
  limit?: number;
  offset?: number;
  status?: string;
  omsOrderId?: string;
  createdFrom?: string;
  createdTo?: string;
}): Promise<ClientOmsReturnsPage> {
  const { data } = await apiClient.get<ClientOmsReturnsPage>('/oms/returns', { params });
  return data;
}

export async function downloadClientOmsReturnsExcel(params: {
  status?: string;
  createdFrom?: string;
  createdTo?: string;
  format?: 'xlsx' | 'csv';
}): Promise<void> {
  const format = params.format ?? 'xlsx';
  const { data } = await apiClient.get('/oms/returns/export', {
    params: {
      status: params.status,
      createdFrom: params.createdFrom,
      createdTo: params.createdTo,
      format,
    },
    responseType: 'blob',
  });
  const isCsv = format === 'csv';
  const blob = new Blob([data], {
    type: isCsv
      ? 'text/csv;charset=utf-8'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const day = new Date().toISOString().slice(0, 10);
  a.download = isCsv ? `oms-returns-${day}.csv` : `oms-returns-${day}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function fetchClientOmsReturn(id: string): Promise<ClientOmsReturnRow> {
  const { data } = await apiClient.get<ClientOmsReturnRow>(`/oms/returns/${id}`);
  return data;
}

export async function createClientOmsReturn(
  input: CreateClientOmsReturnInput,
): Promise<ClientOmsReturnRow> {
  const { data } = await apiClient.post<ClientOmsReturnRow>('/oms/returns', input);
  return data;
}
