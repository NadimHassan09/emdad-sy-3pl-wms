import { api } from './client';

export type AuthGroup = 'ADMIN' | 'OPERATOR';

export type LoginResponseUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  authGroup: AuthGroup;
};

export type LoginResponse = {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  user: LoginResponseUser;
};

export type MeResponse = {
  id: string;
  fullName?: string;
  email: string | null;
  role: string;
  authGroup: AuthGroup;
  tenantCompanyId: string | null;
};

export const AuthApi = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
    return data;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },

  async me(): Promise<MeResponse> {
    const { data } = await api.get<MeResponse>('/auth/me');
    return data;
  },
};
