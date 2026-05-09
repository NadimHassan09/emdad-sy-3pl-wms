import { apiClient } from './apiClient';

export interface ClientProductRow {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  uom: string;
  status: 'active' | 'suspended' | 'archived';
  totalOnHand?: string;
}

export interface ClientProductsPage {
  items: ClientProductRow[];
  total: number;
  limit: number;
  offset: number;
}

export async function fetchClientProducts(params: {
  limit?: number;
  offset?: number;
  search?: string;
  productName?: string;
  sku?: string;
  productBarcode?: string;
}): Promise<ClientProductsPage> {
  const { data } = await apiClient.get<ClientProductsPage>('/products', { params });
  return data;
}
