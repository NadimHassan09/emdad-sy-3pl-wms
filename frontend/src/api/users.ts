import { api } from './client';

export type UserKind = 'system' | 'client';
export type UserStatus = 'active' | 'inactive';
export type UserRole =
  | 'super_admin'
  | 'wh_manager'
  | 'wh_operator'
  | 'finance'
  | 'client_admin'
  | 'client_staff';

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
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  lastActivityAt: string | null;
};

export type CreateSystemUserPayload = {
  kind: 'system';
  email: string;
  fullName: string;
  phone?: string;
  password: string;
  systemRole: 'super_admin' | 'admin' | 'worker';
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
  async list(params?: { kind?: 'all' | 'system' | 'client' }): Promise<UserListRow[]> {
    const q = params?.kind && params.kind !== 'all' ? { kind: params.kind } : {};
    const { data } = await api.get<UserListRow[]>('/users', { params: q });
    return data;
  },

  async get(id: string): Promise<UserListRow> {
    const { data } = await api.get<UserListRow>(`/users/${id}`);
    return data;
  },

  async create(payload: CreateUserPayload): Promise<UserListRow> {
    const { data } = await api.post<UserListRow>('/users', payload);
    return data;
  },

  async update(id: string, payload: UpdateUserPayload): Promise<UserListRow> {
    const { data } = await api.patch<UserListRow>(`/users/${id}`, payload);
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
};
