import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

import {
  clearAccessToken,
  getAccessToken,
  isPersistSessionEnabled,
  clearContinueSession,
  setAccessToken,
  setPostLoginReturnTo,
} from '../auth/authStorage';
import { getApiBaseUrl } from './apiBaseUrl';

const baseURL = getApiBaseUrl();

export const api: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
});

api.interceptors.request.use((cfg) => {
  const token = getAccessToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

type RefreshResult = {
  token: string | null;
  transientError: boolean;
};

/** Single-flight refresh so parallel 401s share one cookie rotation. */
let refreshInFlight: Promise<RefreshResult> | null = null;

async function refreshAccessToken(): Promise<RefreshResult> {
  if (!refreshInFlight) {
    refreshInFlight = (async (): Promise<RefreshResult> => {
      try {
        const { data } = await api.post<
          Pick<{ access_token: string }, 'access_token'> & {
            expires_in?: number;
            token_type?: string;
          }
        >('/auth/refresh');
        const token = data?.access_token;
        if (!token) return { token: null, transientError: false };
        setAccessToken(token, isPersistSessionEnabled());
        return { token, transientError: false };
      } catch (err: unknown) {
        const axiosErr = err as AxiosError;
        const status = axiosErr?.response?.status;
        const isNetwork =
          !axiosErr?.response ||
          axiosErr?.code === 'ERR_NETWORK' ||
          axiosErr?.code === 'ECONNABORTED';
        const isTransientServerIssue =
          status === 502 || status === 503 || status === 504 || isNetwork;
        return {
          token: null,
          transientError: Boolean(isTransientServerIssue),
        };
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

function isAuthSessionUrl(url: string): boolean {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/logout') ||
    url.includes('/auth/refresh')
  );
}

function forceLoginRedirect(): void {
  if (typeof window === 'undefined') return;
  if (window.location.pathname.startsWith('/login')) return;
  const returnTo = `${window.location.pathname}${window.location.search}`;
  setPostLoginReturnTo(returnTo);
  window.location.assign(`/login?next=${encodeURIComponent(returnTo)}`);
}

/**
 * Unwrap the `{ success, data }` envelope and surface backend error codes
 * as proper Error instances with the `code` carried in `(err as any).code`.
 *
 * On 401: try refresh (remember-me cookie) once, then retry. Only clear the
 * persisted session after refresh fails — otherwise "Remember me for 30 days"
 * was wiped whenever the short-lived access JWT expired.
 *
 * During server restarts (502 / 503 / Network Error), suppress silent logout
 * to keep user session safe.
 */
api.interceptors.response.use(
  (resp) => {
    const body = resp.data as ApiSuccess<unknown> | ApiError | unknown;
    if (body && typeof body === 'object' && 'success' in (body as object)) {
      const env = body as ApiSuccess<unknown> | ApiError;
      if (env.success) {
        resp.data = env.data;
        return resp;
      }
      throw Object.assign(new Error(env.error.message), {
        code: env.error.code,
        details: env.error.details,
      });
    }
    return resp;
  },
  async (err: AxiosError<ApiError>) => {
    const status = err.response?.status;
    const original = err.config as RetriableConfig | undefined;
    const reqUrl = String(original?.url ?? '');

    if (status === 401 && original && !original._retry && !isAuthSessionUrl(reqUrl)) {
      original._retry = true;
      const priorToken = getAccessToken();
      const result = await refreshAccessToken();
      if (result.token) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${result.token}`;
        return api(original);
      }
      // If failure is transient (server restart, 502/503, network drop),
      // DO NOT force logout. Restore prior token and reject peacefully.
      if (result.transientError) {
        if (priorToken) {
          setAccessToken(priorToken, isPersistSessionEnabled());
        }
        return Promise.reject(err);
      }
      // Definitive session invalidation confirmed by server
      clearContinueSession();
      clearAccessToken();
      forceLoginRedirect();
    }

    const data = err.response?.data;
    if (data && typeof data === 'object' && 'error' in data) {
      const wrapped = Object.assign(new Error(data.error.message), {
        code: data.error.code,
        details: data.error.details,
        status,
      });
      return Promise.reject(wrapped);
    }
    return Promise.reject(err);
  },
);

/**
 * Standard list-page payload shape used across modules.
 */
export interface PageResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
