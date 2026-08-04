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
  fullName?: string | null;
  email: string | null;
  role: string;
  authGroup: AuthGroup;
  tenantCompanyId: string | null;
  workerId: string | null;
};

export const AuthApi = {
  async login(
    email: string,
    password: string,
    options?: { rememberMe?: boolean },
  ): Promise<LoginResponse> {
    const body: { email: string; password: string; rememberMe?: boolean } = {
      email,
      password,
    };
    if (options?.rememberMe) {
      body.rememberMe = true;
    }
    const { data } = await api.post<LoginResponse>('/auth/login', body);
    return data;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },

  async me(): Promise<MeResponse> {
    const { data } = await api.get<MeResponse>('/auth/me');
    return data;
  },

  async refreshSession(): Promise<Pick<LoginResponse, 'access_token' | 'expires_in' | 'token_type'>> {
    const { data } = await api.post<Pick<LoginResponse, 'access_token' | 'expires_in' | 'token_type'>>(
      '/auth/refresh',
    );
    return data;
  },
};
