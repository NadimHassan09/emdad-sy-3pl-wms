import { apiClient } from './apiClient';

export type ProductAvailability = {
  productId: string;
  companyId: string;
  onHand: string;
  reserved: string;
  available: string;
  /** Expected return qty from open OMS returns — not sellable until warehouse receipt. */
  expectedReturn?: string;
};

export async function fetchProductAvailability(productId: string): Promise<ProductAvailability> {
  const { data } = await apiClient.get<ProductAvailability>('/stock/availability', {
    params: { productId },
  });
  return data;
}
