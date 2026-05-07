import { apiClient } from './apiClient';

/** Per-product totals from `GET /stock` (no warehouse / location / lot). */
export interface ClientStockRow {
  productId: string;
  productName: string;
  sku: string;
  totalQuantity: string;
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
