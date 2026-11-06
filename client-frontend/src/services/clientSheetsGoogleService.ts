import { apiClient } from './apiClient';

export interface GoogleSheetsStatus {
  connected: boolean;
  sheetId: string | null;
  sheetUrl: string | null;
}

export async function fetchGoogleSheetsStatus(): Promise<GoogleSheetsStatus> {
  const res = await apiClient.get<GoogleSheetsStatus>('/sheets/google/status');
  return res.data;
}

export async function getGoogleSheetsAuthorizeUrl(): Promise<string> {
  const res = await apiClient.get<{ url: string }>('/sheets/google/authorize');
  return res.data.url;
}

export async function createGoogleSheet(): Promise<{ sheetId: string; sheetUrl: string }> {
  const res = await apiClient.get<{ sheetId: string; sheetUrl: string }>('/sheets/google/create-sheet');
  return res.data;
}

export async function disconnectGoogleSheets(): Promise<void> {
  await apiClient.delete('/sheets/google/disconnect');
}
