import { api } from './client';

export type LocationType =
  | 'warehouse'
  | 'view'
  | 'input'
  | 'qc'
  | 'internal'
  | 'packing'
  | 'output'
  | 'quarantine'
  | 'scrap'
  | 'transit'
  /** Internal Storage Section (aisle) — parent-only; cannot store stock directly */
  | 'iss'
  | 'fridge';

export interface Location {
  id: string;
  warehouseId: string;
  parentId: string | null;
  name: string;
  fullPath: string;
  type: LocationType;
  barcode: string;
  status: string;
  maxWeightKg?: string | number | null;
  maxCbm?: string | number | null;
}

export interface LocationTreeNode {
  id: string;
  name: string;
  fullPath: string;
  type: string;
  barcode: string;
  children: LocationTreeNode[];
}

export interface LocationsPurgeContext {
  locationIdsWithStock: string[];
  locationIdsOnAdjustments: string[];
}

export interface CreateLocationInput {
  warehouseId: string;
  parentId?: string;
  name: string;
  type?: LocationType;
  barcode?: string;
  maxWeightKg?: number;
  maxCbm?: number;
}

export interface UpdateLocationInput {
  name?: string;
  type?: LocationType;
  barcode?: string;
  sortOrder?: number;
  /** `blocked` = suspended (not used in inventory moves / tasks). */
  status?: 'active' | 'blocked';
  maxWeightKg?: number;
  maxCbm?: number;
  maxPalletPositions?: number;
}

export const LocationsApi = {
  async list(warehouseId?: string, includeArchived = false): Promise<Location[]> {
    const { data } = await api.get<Location[]>('/locations', {
      params: warehouseId ? { warehouseId, includeArchived } : { includeArchived },
    });
    return data;
  },
  async tree(warehouseId: string): Promise<LocationTreeNode[]> {
    const { data } = await api.get<LocationTreeNode[]>('/locations/tree', {
      params: { warehouseId },
    });
    return data;
  },
  async purgeContext(warehouseId: string): Promise<LocationsPurgeContext> {
    const { data } = await api.get<LocationsPurgeContext>('/locations/purge-context', {
      params: { warehouseId },
    });
    return data;
  },
  async create(input: CreateLocationInput): Promise<Location> {
    const { data } = await api.post<Location>('/locations', input);
    return data;
  },
  async update(id: string, input: UpdateLocationInput): Promise<Location> {
    const { data } = await api.patch<Location>(`/locations/${id}`, input);
    return data;
  },
  /** Soft-archive location when guards pass. */
  async archive(id: string): Promise<Location> {
    const { data } = await api.delete<Location>(`/locations/${id}`);
    return data;
  },
  /** Permanently delete this location and all descendants (server enforces zero stock / no adjustment lines). */
  async permanentDelete(id: string): Promise<{ deletedIds: string[] }> {
    const { data } = await api.delete<{ deletedIds: string[] }>(`/locations/${id}/permanent`);
    return data;
  },
};
