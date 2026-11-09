import { apiClient } from './apiClient';

/** Per-product totals from `GET /stock` (no warehouse / location / lot). */
export interface ClientStockRow {
  productId: string;
  productName: string;
  sku: string;
  totalQuantity: string;
  onHand: string;
  reserved: string;
  available: string;
  uom: string;
  expiryDate: string | null;
}

export interface ClientStockPage {
  items: ClientStockRow[];
  total: number;
  limit: number;
  offset: number;
}

export async function fetchStockPage(params: {
  limit?: number;
  offset?: number;
  productSearch?: string;
}): Promise<ClientStockPage> {
  const { data } = await apiClient.get<ClientStockPage>('/stock', { params });
  return data;
}

export async function downloadClientStockExport(params: {
  search?: string;
  format?: 'xlsx' | 'csv';
} = {}): Promise<void> {
  const format = params.format ?? 'xlsx';
  const response = await apiClient.get<Blob>('/stock/export', {
    params: { search: params.search, format },
    responseType: 'blob',
  });
  const disposition = response.headers['content-disposition'] as string | undefined;
  const match = disposition?.match(/filename="([^"]+)"/);
  const filename =
    match?.[1] ?? `inventory-stock-${new Date().toISOString().slice(0, 10)}.${format}`;
  const url = URL.createObjectURL(response.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
