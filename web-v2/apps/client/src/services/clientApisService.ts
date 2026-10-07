import { apiClient } from './apiClient';

export type ClientApiScope = 'oms' | 'inbound' | 'outbound';
export type ClientApiStatus = 'active' | 'disabled' | 'revoked';

export interface ClientApiCredential {
  id: string;
  name: string;
  scope: ClientApiScope;
  status: ClientApiStatus;
  maskedKey: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface ClientApiSecretOnce extends ClientApiCredential {
  apiKey: string;
  apiSecret: string;
  warning: string;
}

export function fetchClientApis(): Promise<ClientApiCredential[]> {
  return apiClient.get('/apis').then((r) => r.data);
}

export function createClientApi(input: {
  name: string;
  scope: ClientApiScope;
}): Promise<ClientApiSecretOnce> {
  return apiClient.post('/apis', input).then((r) => r.data);
}

export function regenerateClientApiSecret(id: string): Promise<ClientApiSecretOnce> {
  return apiClient.post(`/apis/${id}/regenerate`).then((r) => r.data);
}

export function revokeClientApi(id: string): Promise<ClientApiCredential> {
  return apiClient.post(`/apis/${id}/revoke`).then((r) => r.data);
}

export function setClientApiEnabled(id: string, enabled: boolean): Promise<ClientApiCredential> {
  return apiClient.patch(`/apis/${id}/enabled`, { enabled }).then((r) => r.data);
}

export async function downloadClientApiDocs(id: string, scope: ClientApiScope): Promise<void> {
  const response = await apiClient.get(`/apis/${id}/docs`, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `emdad-${scope}-api-documentation.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
