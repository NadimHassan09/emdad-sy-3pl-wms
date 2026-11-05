import { apiClient } from './apiClient';

export interface ClientWebhook {
  id: string;
  url: string;
  isActive: boolean;
  consecutiveFailures: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface ClientWebhookWithSecret extends ClientWebhook {
  secret: string;
  secretNotice: string;
}

export interface ClientWebhookDelivery {
  id: string;
  event: string;
  orderNumber: string | null;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  lastHttpStatus: number | null;
  lastError: string | null;
  createdAt: string;
  deliveredAt: string | null;
}

export const fetchWebhooks = (): Promise<ClientWebhook[]> => apiClient.get('/webhooks').then((r) => r.data);
export const createWebhook = (url: string): Promise<ClientWebhookWithSecret> =>
  apiClient.post('/webhooks', { url }).then((r) => r.data);
export const rotateWebhookSecret = (id: string): Promise<ClientWebhookWithSecret> =>
  apiClient.post(`/webhooks/${id}/rotate-secret`).then((r) => r.data);
export const testWebhook = (id: string): Promise<{ queued: boolean }> =>
  apiClient.post(`/webhooks/${id}/test`).then((r) => r.data);
export const setWebhookEnabled = (id: string, enabled: boolean): Promise<ClientWebhook> =>
  apiClient.patch(`/webhooks/${id}/enabled`, { enabled }).then((r) => r.data);
export const deleteWebhook = (id: string): Promise<{ deleted: boolean }> =>
  apiClient.delete(`/webhooks/${id}`).then((r) => r.data);
export const fetchWebhookDeliveries = (id: string): Promise<ClientWebhookDelivery[]> =>
  apiClient.get(`/webhooks/${id}/deliveries`).then((r) => r.data);
