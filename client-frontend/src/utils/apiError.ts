import type { AxiosError } from 'axios';

interface NestErrorBody {
  success?: false;
  error?: { message?: string; code?: string };
  message?: string | string[];
}

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (typeof error !== 'object' || error === null) return fallback;
  const ax = error as AxiosError<NestErrorBody>;
  const data = ax.response?.data;
  if (data && typeof data === 'object') {
    if (typeof data.error?.message === 'string' && data.error.message) {
      return data.error.message;
    }
    const m = data.message;
    if (typeof m === 'string' && m) return m;
    if (Array.isArray(m) && m.length) return m.join('; ');
  }
  if (ax.message) return ax.message;
  return fallback;
}
