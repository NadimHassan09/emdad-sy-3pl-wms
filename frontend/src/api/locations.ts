import { PageResult, api } from './client';

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
  childCount?: number;
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

export interface ListLocationsChildrenParams {
  warehouseId: string;
  parentId?: string;
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  type?: string;
  includeArchived?: boolean;
}

export interface LookupLocationsParams {
  warehouseId: string;
  search?: string;
  limit?: number;
  offset?: number;
  type?: string;
  status?: string;
  includeArchived?: boolean;
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
  /** Paginated direct children (hierarchical navigation). */
  async listChildren(params: ListLocationsChildrenParams): Promise<PageResult<Location>> {
    const { data } = await api.get<PageResult<Location>>('/locations', {
      params: {
        limit: params.limit ?? 200,
        offset: params.offset ?? 0,
        warehouseId: params.warehouseId,
        ...(params.parentId ? { parentId: params.parentId } : {}),
        ...(params.search ? { search: params.search } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.type ? { type: params.type } : {}),
        ...(params.includeArchived ? { includeArchived: true } : {}),
      },
    });
    return data;
  },

  /** Warehouse-wide search (parent picker, typeahead). */
  async lookup(params: LookupLocationsParams): Promise<PageResult<Location>> {
    const { data } = await api.get<PageResult<Location>>('/locations/lookup', {
      params: {
        warehouseId: params.warehouseId,
        limit: params.limit ?? 25,
        offset: params.offset ?? 0,
        ...(params.search ? { search: params.search } : {}),
        ...(params.type ? { type: params.type } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.includeArchived ? { includeArchived: true } : {}),
      },
    });
    return data;
  },

  async getById(id: string): Promise<Location> {
    const { data } = await api.get<Location>(`/locations/${id}`);
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

  async archive(id: string): Promise<Location> {
    const { data } = await api.delete<Location>(`/locations/${id}`);
    return data;
  },

  async permanentDelete(id: string): Promise<{ deletedIds: string[] }> {
    const { data } = await api.delete<{ deletedIds: string[] }>(`/locations/${id}/permanent`);
    return data;
  },
};
