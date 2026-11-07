import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { ShippingCredentials } from '../../shipping-provider.interface';
import { FATIH_CARGO_BASE_URL } from './fatih-cargo.constants';

export class FatihApiError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'FatihApiError';
  }
}

/** API key lives in username (Bearer fc_live_…). Password may be N/A. */
export function extractFatihApiKey(credentials: ShippingCredentials): string {
  const candidates = [credentials.username, credentials.password];
  for (const c of candidates) {
    const s = (c || '').trim();
    if (s && s.toUpperCase() !== 'N/A') return s;
  }
  throw new BadRequestException('Fatih Cargo API key is missing.');
}

@Injectable()
export class FatihCargoHttpClient {
  private readonly logger = new Logger(FatihCargoHttpClient.name);

  async get<T = unknown>(
    endpoint: string,
    credentials: ShippingCredentials,
    query?: Record<string, string | number | boolean | undefined | null>,
  ): Promise<T> {
    return this.request<T>('GET', endpoint, credentials, undefined, query);
  }

  async post<T = unknown>(
    endpoint: string,
    credentials: ShippingCredentials,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    return this.request<T>('POST', endpoint, credentials, body, undefined, extraHeaders);
  }

  private async request<T = unknown>(
    method: 'GET' | 'POST',
    endpoint: string,
    credentials: ShippingCredentials,
    body?: unknown,
    query?: Record<string, string | number | boolean | undefined | null>,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const apiKey = extractFatihApiKey(credentials);
    const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const baseUrl = FATIH_CARGO_BASE_URL.replace(/\/+$/, '');
    let url = `${baseUrl}${cleanPath}`;

    if (query) {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          sp.append(k, String(v));
        }
      }
      const qs = sp.toString();
      if (qs) url += (url.includes('?') ? '&' : '?') + qs;
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...extraHeaders,
        },
        body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      this.logger.warn(`Fatih Cargo ${method} ${cleanPath} network error: ${msg}`);
      throw new FatihApiError(`Fatih Cargo request failed: ${msg}`);
    }

    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!res.ok) {
      const detail =
        typeof parsed === 'object' && parsed && 'message' in parsed
          ? String((parsed as { message?: unknown }).message)
          : typeof parsed === 'object' && parsed && 'error' in parsed
            ? String((parsed as { error?: unknown }).error)
            : text?.slice(0, 300) || res.statusText;
      throw new FatihApiError(
        `Fatih Cargo ${method} ${cleanPath} failed (${res.status}): ${detail}`,
        res.status,
        parsed,
      );
    }

    return parsed as T;
  }
}
