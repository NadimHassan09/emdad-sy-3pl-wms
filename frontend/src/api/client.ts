import axios, { AxiosError, AxiosInstance } from 'axios';

import { getAccessToken, setAccessToken } from '../auth/authStorage';

const baseURL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api';
const mockCompanyId = import.meta.env.VITE_MOCK_COMPANY_ID as string | undefined;

export const api: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
});

api.interceptors.request.use((cfg) => {
  const token = getAccessToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  const url = typeof cfg.url === 'string' ? cfg.url : '';
  const isDashboard = url.includes('/dashboard/');
  const isCompaniesList = url.includes('/companies');
  if (mockCompanyId && !isDashboard && !isCompaniesList && !cfg.headers['X-Company-Id']) {
    cfg.headers['X-Company-Id'] = mockCompanyId;
  }
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

/**
 * Unwrap the `{ success, data }` envelope and surface backend error codes
 * as proper Error instances with the `code` carried in `(err as any).code`.
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
  (err: AxiosError<ApiError>) => {
    const status = err.response?.status;
    if (status === 401) {
      setAccessToken(null);
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
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
