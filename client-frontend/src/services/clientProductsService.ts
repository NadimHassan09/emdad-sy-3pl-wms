import { apiClient } from './apiClient';

export type ClientProductUom = 'piece' | 'kg' | 'litre' | 'carton' | 'pallet' | 'box' | 'roll';

export interface ClientProductRow {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  description?: string | null;
  uom: string;
  status: 'active' | 'suspended' | 'archived';
  expiryTracking?: boolean;
  totalOnHand?: string;
}

export interface ClientProductsPage {
  items: ClientProductRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateClientProductInput {
  name: string;
  sku?: string;
  barcode?: string;
  description?: string;
  uom?: ClientProductUom;
  expiryTracking?: boolean;
  minStockThreshold?: number;
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

export async function createClientProduct(input: CreateClientProductInput): Promise<ClientProductRow> {
  const { data } = await apiClient.post<ClientProductRow>('/products', input);
  return data;
}
