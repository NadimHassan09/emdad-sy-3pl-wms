import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { clearStoredBearer, getStoredBearer } from './authStorage';
import { isSuccessEnvelope } from '../types/api';
import { getClientApiBaseUrl } from './apiBaseUrl';

const baseURL = getClientApiBaseUrl();

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
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    // Let the browser set multipart boundary.
    if (typeof config.headers.delete === 'function') {
      config.headers.delete('Content-Type');
    } else {
      delete (config.headers as Record<string, unknown>)['Content-Type'];
    }
  }
  return config;
});

/**
 * Returns true when the error is a transient server-side issue caused by
 * a backend restart, deploy, or momentary network blip — NOT a real auth failure.
 *
 * During pm2 restart, Nginx may return 502/503/504 or the request may fail
 * entirely with a network error before the backend is back up. We must NOT
 * clear the session or redirect to login in these cases.
 */
function isTransientServerError(error: AxiosError): boolean {
  const status = error.response?.status;
  const isNetworkError =
    !error.response ||
    error.code === 'ERR_NETWORK' ||
    error.code === 'ECONNABORTED';
  return isNetworkError || status === 502 || status === 503 || status === 504;
}

apiClient.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (isSuccessEnvelope(body)) {
      response.data = body.data;
    }
    return response;
  },
  (error: AxiosError<{ success?: false; error?: { message?: string } }>) => {
    const status = error.response?.status;

    // Surface backend error message first, regardless of status
    const apiMessage = error.response?.data?.error?.message;
    if (apiMessage) {
      return Promise.reject(new Error(apiMessage));
    }

    const url = String(error.config?.url ?? '');
    const isLoginAttempt = url.includes('/auth/login');
    const authHeader = error.config?.headers?.Authorization;
    const hadBearer =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ');

    /** Anonymous "who am I?" — 401 is expected; do not clear session or force navigation. */
    const isAnonymousMeProbe = url.includes('/auth/me') && !hadBearer;

    if ((status === 401 || status === 403) && !isLoginAttempt && !isAnonymousMeProbe) {
      // During a backend restart, Nginx may briefly return 502/503 before a
      // proper 401. Guard against that so we don't wipe the session on a
      // transient error. Only act on a definitive auth rejection from the server.
      if (isTransientServerError(error)) {
        // Transient — server is restarting. Keep session intact, reject quietly.
        return Promise.reject(error);
      }

      // Definitive session invalidation confirmed by the backend.
      clearStoredBearer();
      onUnauthorized?.();
    }

    return Promise.reject(error);
  },
);
