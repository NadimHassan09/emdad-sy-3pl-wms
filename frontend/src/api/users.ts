import { api, type PageResult } from './client';

export type UserKind = 'system' | 'client';
export type UserStatus = 'active' | 'inactive';
export type UserRole =
  | 'super_admin'
  | 'wh_manager'
  | 'wh_operator'
  | 'finance'
  | 'viewer'
  | 'inventory_controller'
  | 'client_admin'
  | 'client_staff';

export type UserWorkerProfileSummary = {
  id: string;
  status: string;
  warehouseId: string | null;
  warehouseCode: string | null;
  warehouseName: string | null;
  roles: string[];
};

export type UserListRow = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  companyId: string | null;
  companyName: string | null;
  kind: UserKind;
  avatarUrl: string | null;
  workerProfile: UserWorkerProfileSummary | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  lastActivityAt: string | null;
};

export type UpsertUserWorkerProfilePayload = {
  warehouseId?: string | null;
  roles?: string[];
  linkWorkerId?: string;
};

export type ListUsersQuery = {
  kind?: 'all' | 'system' | 'client';
  search?: string;
  role?: UserRole;
  companyId?: string;
  limit?: number;
  offset?: number;
};

export type CreateSystemUserPayload = {
  kind: 'system';
  email: string;
  fullName: string;
  phone?: string;
  password: string;
  systemRole: 'super_admin' | 'admin' | 'worker' | 'accountant' | 'viewer' | 'inventory';
  workerWarehouseId?: string;
};

export type CreateClientUserPayload = {
  kind: 'client';
  email: string;
  fullName: string;
  phone?: string;
  password: string;
  companyId: string;
  clientRole: 'client_admin' | 'client_staff';
};

export type CreateUserPayload = CreateSystemUserPayload | CreateClientUserPayload;

export type UpdateUserPayload = {
  email?: string;
  fullName?: string;
  phone?: string | null;
  password?: string;
  role?: UserRole;
  status?: UserStatus;
  companyId?: string;
};

export const UsersApi = {
  list(params: ListUsersQuery = {}) {
    return api.get<PageResult<UserListRow>>('/users', { params }).then((r) => r.data);
  },

  async get(id: string): Promise<UserListRow> {
    const { data } = await api.get<UserListRow>(`/users/${id}`);
    return data;
  },

  async create(payload: CreateUserPayload): Promise<UserListRow> {
    const headers =
      payload.kind === 'client' ? { 'X-Company-Id': payload.companyId } : undefined;
    const { data } = await api.post<UserListRow>('/users', payload, { headers });
    return data;
  },

  async update(id: string, payload: UpdateUserPayload): Promise<UserListRow> {
    const headers = payload.companyId ? { 'X-Company-Id': payload.companyId } : undefined;
    const { data } = await api.patch<UserListRow>(`/users/${id}`, payload, { headers });
    return data;
  },

  async suspend(id: string): Promise<UserListRow> {
    const { data } = await api.post<UserListRow>(`/users/${id}/suspend`);
    return data;
  },

  async remove(id: string): Promise<{ id: string; deleted: true }> {
    const { data } = await api.delete<{ id: string; deleted: true }>(`/users/${id}`);
    return data;
  },

  async getWorkerProfile(userId: string): Promise<UserWorkerProfileSummary | null> {
    const { data } = await api.get<UserWorkerProfileSummary | null>(
      `/users/${userId}/worker-profile`,
    );
    return data;
  },

  async upsertWorkerProfile(
    userId: string,
    payload: UpsertUserWorkerProfilePayload,
  ): Promise<UserWorkerProfileSummary> {
    const { data } = await api.put<UserWorkerProfileSummary>(
      `/users/${userId}/worker-profile`,
      payload,
    );
    return data;
  },

  async listCustomRoles(): Promise<CustomRoleRow[]> {
    const { data } = await api.get<CustomRoleRow[]>('/users/custom-roles');
    return data;
  },

  async createCustomRole(payload: UpsertCustomRolePayload): Promise<CustomRoleRow> {
    const { data } = await api.post<CustomRoleRow>('/users/custom-roles', payload);
    return data;
  },

  async updateCustomRole(id: string, payload: UpsertCustomRolePayload): Promise<CustomRoleRow> {
    const { data } = await api.patch<CustomRoleRow>(`/users/custom-roles/${id}`, payload);
    return data;
  },

  async deleteCustomRole(id: string): Promise<{ ok: boolean }> {
    const { data } = await api.delete<{ ok: boolean }>(`/users/custom-roles/${id}`);
    return data;
  },
};

export type CustomRolePermission = {
  id?: string;
  module: string;
  action: string;
  allowed: boolean;
};

export type CustomRoleRow = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  permissions?: CustomRolePermission[];
  _count?: { users: number };
};

export type UpsertCustomRolePayload = {
  name?: string;
  description?: string;
  isActive?: boolean;
  permissions?: Array<{ module: string; action: string; allowed: boolean }>;
};
