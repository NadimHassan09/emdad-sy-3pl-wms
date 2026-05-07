import type { ClientLoginPayload, ClientUser } from '../types/auth';
import { apiClient } from './apiClient';
import { clearStoredBearer, setStoredBearer } from './authStorage';

function mapUser(row: ClientLoginPayload['user']): ClientUser {
  const role = row.role === 'client_staff' ? 'client_staff' : 'client_admin';
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName ?? '',
    role,
    companyId: row.companyId,
    companyName: row.companyName ?? '',
  };
}

export async function login(email: string, password: string): Promise<ClientUser> {
  const { data } = await apiClient.post<ClientLoginPayload>('/auth/login', { email, password });
  setStoredBearer(data.access_token);
  return mapUser(data.user);
}

export async function fetchCurrentUser(): Promise<ClientUser> {
  const { data } = await apiClient.get<ClientUser>('/auth/me');
  return data;
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } finally {
    clearStoredBearer();
  }
}
