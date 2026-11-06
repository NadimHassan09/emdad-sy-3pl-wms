import { api } from './client';

export interface GoogleOAuthView {
  hasClientId: boolean;
  clientIdPreview: string | null;
  hasClientSecret: boolean;
  redirectUri: string | null;
  lastTestAt: string | null;
  lastTestStatus: 'ok' | 'error' | null;
  lastTestError: string | null;
  updatedAt: string;
}

export interface UpsertGoogleOAuthInput {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
}

export async function fetchGoogleOAuthSettings(): Promise<GoogleOAuthView> {
  const { data } = await api.get<GoogleOAuthView>('/settings/google-oauth');
  return data;
}

export async function saveGoogleOAuthSettings(input: UpsertGoogleOAuthInput): Promise<GoogleOAuthView> {
  const { data } = await api.put<GoogleOAuthView>('/settings/google-oauth', input);
  return data;
}

export async function testGoogleOAuthSettings(): Promise<GoogleOAuthView> {
  const { data } = await api.post<GoogleOAuthView>('/settings/google-oauth/test', {});
  return data;
}
