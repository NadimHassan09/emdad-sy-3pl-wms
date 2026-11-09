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
  minStockThreshold?: string | number | null;
  totalOnHand?: string;
  totalReserved?: string;
  totalAvailable?: string;
  imageUrl?: string | null;
  imagePath?: string | null;
  /** True when hard-delete is allowed (zero stock and no order / inventory history). */
  deletable?: boolean;
}

export interface ClientProductDetail {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  uom: string;
  status: 'active' | 'suspended' | 'archived';
  expiryTracking: boolean;
  minStockThreshold: string;
  category: string | null;
  categoryId: string | null;
  lengthCm: string | null;
  widthCm: string | null;
  heightCm: string | null;
  weightKg: string | null;
  volumeCbm: string | null;
  inventoryMethod: 'FIFO' | 'FEFO' | 'LIFO';
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  totalOnHand: string;
  totalReserved: string;
  totalAvailable: string;
  totalInboundQuantity: string;
  totalOutboundQuantity: string;
  earliestExpiryDate: string | null;
  imageUrl?: string | null;
  imagePath?: string | null;
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

export async function fetchClientProduct(id: string): Promise<ClientProductDetail> {
  const { data } = await apiClient.get<ClientProductDetail>(`/products/${id}`);
  return data;
}

export async function createClientProduct(input: CreateClientProductInput): Promise<ClientProductRow> {
  const { data } = await apiClient.post<ClientProductRow>('/products', input);
  return data;
}

export interface UpdateClientProductInput {
  name?: string;
  description?: string;
  minStockThreshold?: number;
}

export async function updateClientProduct(
  id: string,
  input: UpdateClientProductInput,
): Promise<ClientProductDetail> {
  const { data } = await apiClient.patch<ClientProductDetail>(`/products/${id}`, input);
  return data;
}

export async function deleteClientProduct(id: string): Promise<{ id: string; deleted: true }> {
  const { data } = await apiClient.delete<{ id: string; deleted: true }>(`/products/${id}`);
  return data;
}

export async function uploadClientProductImage(
  productId: string,
  file: File,
): Promise<{ imageUrl: string; byteSize: number }> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<{ imageUrl: string; byteSize: number }>(
    `/products/${productId}/image`,
    form,
  );
  return data;
}

export async function deleteClientProductImage(productId: string): Promise<void> {
  await apiClient.delete(`/products/${productId}/image`);
}

export async function downloadClientProductsExcel(params: {
  search?: string;
  status?: string;
  format?: 'xlsx' | 'csv';
}): Promise<void> {
  const format = params.format ?? 'xlsx';
  const { data } = await apiClient.get('/products/export', {
    params: { search: params.search, status: params.status, format },
    responseType: 'blob',
  });
  const blob = new Blob([data], {
    type:
      format === 'csv'
        ? 'text/csv;charset=utf-8'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inventory-products-${new Date().toISOString().slice(0, 10)}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
