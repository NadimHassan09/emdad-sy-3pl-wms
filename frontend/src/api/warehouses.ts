import { api } from './client';

export type WarehouseStatus = 'active' | 'inactive';

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  country: string;
  status: WarehouseStatus;
  createdAt: string;
}

export interface CreateWarehouseInput {
  name: string;
  code?: string;
  address?: string;
  city?: string;
  country?: string;
}

export interface UpdateWarehouseInput {
  name?: string;
  address?: string;
  city?: string;
  country?: string;
}

export const WarehousesApi = {
  async list(includeInactive = false): Promise<Warehouse[]> {
    const { data } = await api.get<Warehouse[]>('/warehouses', {
      params: { includeInactive },
    });
    return data;
  },
  async create(input: CreateWarehouseInput): Promise<Warehouse> {
    const { data } = await api.post<Warehouse>('/warehouses', input);
    return data;
  },
  async update(id: string, input: UpdateWarehouseInput): Promise<Warehouse> {
    const { data } = await api.patch<Warehouse>(`/warehouses/${id}`, input);
    return data;
  },
  /** Soft-deactivate warehouse (inactive) when guards pass. */
  async deactivate(id: string): Promise<Warehouse> {
    const { data } = await api.delete<Warehouse>(`/warehouses/${id}`);
    return data;
  },
  async nextCode(): Promise<{ code: string }> {
    const { data } = await api.get<{ code: string }>('/warehouses/next-code');
    return data;
  },
  async setStatus(id: string, status: WarehouseStatus): Promise<Warehouse> {
    const { data } = await api.patch<Warehouse>(`/warehouses/${id}/status`, { status });
    return data;
  },
};
