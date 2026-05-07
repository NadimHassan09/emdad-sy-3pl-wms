import { PageResult, api } from './client';

export type ProductTrackingType = 'none' | 'lot' | 'package';
export type ProductUom = 'piece' | 'kg' | 'litre' | 'carton' | 'pallet' | 'box' | 'roll';

export interface Product {
  id: string;
  companyId: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  trackingType: ProductTrackingType;
  uom: ProductUom;
  expiryTracking: boolean;
  minStockThreshold: number;
  /** Centimetres; API may return string (decimal). */
  lengthCm?: string | number | null;
  widthCm?: string | number | null;
  heightCm?: string | number | null;
  /** Kilograms; API may return string (decimal). */
  weightKg?: string | number | null;
  status: 'active' | 'suspended' | 'archived';
  createdAt: string;
  company?: { id: string; name: string };
  /** Sum of `quantity_on_hand` across stock rows (from list API). */
  totalOnHand?: string;
  totalReserved?: string;
  /** Server hint: stock is zero and row is not archived (delete may still fail on FKs). */
  deletable?: boolean;
}

export interface CreateProductInput {
  companyId: string;
  name: string;
  sku?: string;
  barcode?: string;
  description?: string;
  uom?: ProductUom;
  /** When true, lots for this product require expiry dates where applicable. */
  expiryTracking?: boolean;
  minStockThreshold?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  weightKg?: number;
}

export interface UpdateProductInput {
  expiryTracking?: boolean;
  name?: string;
  sku?: string;
  barcode?: string;
  description?: string;
  uom?: ProductUom;
  minStockThreshold?: number;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
}

export interface ProductListQuery {
  companyId?: string;
  /** Legacy: matches name OR sku OR barcode. */
  search?: string;
  /** Substring match on product name (maps to `productName` query param). */
  productName?: string;
  sku?: string;
  /** Substring match on barcode (maps to `productBarcode` query param). */
  productBarcode?: string;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export interface ProductLot {
  id: string;
  lotNumber: string;
  expiryDate: string | null;
}

export const ProductsApi = {
  async get(id: string): Promise<Product> {
    const { data } = await api.get<Product>(`/products/${id}`);
    return data;
  },

  async listLots(productId: string): Promise<ProductLot[]> {
    const { data } = await api.get<ProductLot[]>(`/products/${productId}/lots`);
    return data;
  },

  async list(query: ProductListQuery = {}): Promise<PageResult<Product>> {
    const params: Record<string, string | number | boolean> = {
      limit: query.limit ?? 200,
    };
    if (query.offset != null) params.offset = query.offset;
    const companyId = query.companyId?.trim();
    if (companyId) params.companyId = companyId;
    const search = query.search?.trim();
    if (search) params.search = search;
    const productName = query.productName?.trim();
    if (productName) params.productName = productName;
    const sku = query.sku?.trim();
    if (sku) params.sku = sku;
    const productBarcode = query.productBarcode?.trim();
    if (productBarcode) params.productBarcode = productBarcode;
    if (query.includeArchived === true) params.includeArchived = true;
    const { data } = await api.get<PageResult<Product>>('/products', { params });
    return data;
  },
  async create(input: CreateProductInput): Promise<Product> {
    const { data } = await api.post<Product>('/products', input);
    return data;
  },
  async update(id: string, input: UpdateProductInput): Promise<Product> {
    const { data } = await api.patch<Product>(`/products/${id}`, input);
    return data;
  },
  async archive(id: string): Promise<Product> {
    const { data } = await api.delete<Product>(`/products/${id}`);
    return data;
  },

  async suspend(id: string): Promise<Product> {
    const { data } = await api.post<Product>(`/products/${id}/suspend`);
    return data;
  },

  async unsuspend(id: string): Promise<Product> {
    const { data } = await api.post<Product>(`/products/${id}/unsuspend`);
    return data;
  },

  /** Permanent delete when server checks pass (no stock, no order/history refs). */
  async hardDelete(id: string): Promise<{ id: string; deleted: true }> {
    const { data } = await api.delete<{ id: string; deleted: true }>(`/products/${id}/hard`);
    return data;
  },
  async nextSku(companyId: string): Promise<{ sku: string }> {
    const { data } = await api.get<{ sku: string }>('/products/next-sku', {
      params: { companyId },
    });
    return data;
  },
};
