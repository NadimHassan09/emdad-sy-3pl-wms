import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { ShippingCredentials } from '../../shipping-provider.interface';
import { SENA_EXPRESS_BASE_URL } from './sena-express.constants';

export class SenaApiError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'SenaApiError';
  }
}

export function extractSenaApiKey(credentials: ShippingCredentials): string {
  const candidates = [credentials.username, credentials.password];
  for (const c of candidates) {
    const s = (c || '').trim();
    if (s && s.toUpperCase() !== 'N/A') return s;
  }
  throw new BadRequestException('SENA Express API key is missing.');
}

@Injectable()
export class SenaExpressHttpClient {
  private readonly logger = new Logger(SenaExpressHttpClient.name);

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
  ): Promise<T> {
    return this.request<T>('POST', endpoint, credentials, body);
  }

  private async request<T = unknown>(
    method: 'GET' | 'POST',
    endpoint: string,
    credentials: ShippingCredentials,
    body?: unknown,
    query?: Record<string, string | number | boolean | undefined | null>,
  ): Promise<T> {
    const apiKey = extractSenaApiKey(credentials);
    const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const baseUrl = SENA_EXPRESS_BASE_URL.replace(/\/+$/, '');
    let url = `${baseUrl}${cleanPath}`;

    if (query) {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          sp.append(k, String(v));
        }
      }
      const qs = sp.toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          'X-SENA-API-Key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`SENA Express ${method} ${cleanPath} network error: ${msg}`);
      throw new SenaApiError(`SENA Express unreachable: ${msg}`);
    }

    let json: any;
    try {
      json = await res.json();
    } catch {
      throw new SenaApiError(
        `SENA Express returned non-JSON (HTTP ${res.status}).`,
        res.status,
      );
    }

    if (!res.ok) {
      const message =
        typeof json?.message === 'string' && json.message.trim()
          ? json.message.trim()
          : typeof json?.error === 'string' && json.error.trim()
            ? json.error.trim()
            : `SENA Express HTTP ${res.status}`;
      throw new SenaApiError(message, res.status, json);
    }

    if (json?.status === 'error' || json?.status === 'fail') {
      const message =
        typeof json?.message === 'string' && json.message.trim()
          ? json.message.trim()
          : 'SENA Express request returned an error status.';
      throw new SenaApiError(message, res.status, json);
    }

    return json as T;
  }
}
