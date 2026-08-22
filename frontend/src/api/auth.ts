import { api } from './client';
import { getApiBaseUrl } from './apiBaseUrl';

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
  avatarUrl?: string | null;
  googleLinked?: boolean;
  googleEmail?: string | null;
  googleLinkedAt?: string | null;
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

  async logout(options?: { soft?: boolean }): Promise<void> {
    await api.post('/auth/logout', options?.soft ? { soft: true } : {});
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

  async googleStatus(): Promise<{ enabled: boolean }> {
    const { data } = await api.get<{ enabled: boolean }>('/auth/google/status');
    return data;
  },

  googleLoginUrl(options?: { rememberMe?: boolean }): string {
    const base = getApiBaseUrl().replace(/\/$/, '');
    const q = options?.rememberMe ? '?rememberMe=1' : '';
    return `${base}/auth/google/login${q}`;
  },

  googleLinkUrl(): string {
    const base = getApiBaseUrl().replace(/\/$/, '');
    return `${base}/auth/google/link`;
  },

  async unlinkGoogle(): Promise<{ unlinked: boolean }> {
    const { data } = await api.post<{ unlinked: boolean }>('/auth/google/unlink');
    return data;
  },

  async uploadAvatar(file: File): Promise<{ avatarUrl: string; user: MeResponse }> {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<{ avatarUrl: string; user: MeResponse }>('/auth/avatar', form);
    return data;
  },

  async deleteAvatar(): Promise<void> {
    await api.delete('/auth/avatar');
  },
};
