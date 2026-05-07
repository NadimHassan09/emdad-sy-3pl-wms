import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { clearStoredBearer, getStoredBearer } from './authStorage';
import { isSuccessEnvelope } from '../types/api';

const baseURL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3000/api/client';

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getStoredBearer();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (isSuccessEnvelope(body)) {
      response.data = body.data;
    }
    return response;
  },
  (error: AxiosError) => {
    const status = error.response?.status;
    const url = String(error.config?.url ?? '');
    const isLoginAttempt = url.includes('/auth/login');
    const authHeader = error.config?.headers?.Authorization;
    const hadBearer =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ');
    /** Anonymous “who am I?” — 401 is expected; do not clear session or force navigation. */
    const isAnonymousMeProbe = url.includes('/auth/me') && !hadBearer;

    if ((status === 401 || status === 403) && !isLoginAttempt && !isAnonymousMeProbe) {
      clearStoredBearer();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);
