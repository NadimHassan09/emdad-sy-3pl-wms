import type { ClientLoginPayload, ClientUser } from '../types/auth';
import { apiClient } from './apiClient';
import { clearStoredBearer, setStoredBearer } from './authStorage';

function mapUser(row: ClientLoginPayload['user'] | ClientUser): ClientUser {
  const role = row.role === 'client_staff' ? 'client_staff' : 'client_admin';
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName ?? '',
    role,
    companyId: row.companyId,
    companyName: row.companyName ?? '',
    avatarUrl: 'avatarUrl' in row ? row.avatarUrl ?? null : null,
  };
}

export async function login(
  email: string,
  password: string,
  options?: { persistSession?: boolean },
): Promise<ClientUser> {
  const rememberMe = Boolean(options?.persistSession);
  const body: { email: string; password: string; rememberMe?: boolean } = {
    email,
    password,
  };
  if (rememberMe) {
    body.rememberMe = true;
  }
  const { data } = await apiClient.post<ClientLoginPayload>('/auth/login', body);
  setStoredBearer(data.access_token, rememberMe);
  return mapUser(data.user);
}

export async function fetchCurrentUser(): Promise<ClientUser> {
  const { data } = await apiClient.get<ClientUser>('/auth/me');
  return mapUser(data);
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } finally {
    clearStoredBearer();
  }
}

export async function uploadClientAvatar(file: File): Promise<ClientUser> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<{ avatarUrl: string; user: ClientUser }>('/auth/avatar', form);
  return mapUser(data.user);
}

export async function deleteClientAvatar(): Promise<void> {
  await apiClient.delete('/auth/avatar');
}
