import { Injectable, Logger } from '@nestjs/common';

export const SILA_SY_BASE_URL =
  process.env.SILA_SY_BASE_URL ||
  'https://qhdhjzyduwzqutmialgp.supabase.co/functions/v1/public-api';

export class SilaSyApiError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'SilaSyApiError';
  }
}

@Injectable()
export class SilaSyHttpClient {
  private readonly logger = new Logger(SilaSyHttpClient.name);

  async get<T = unknown>(path: string, apiKey: string): Promise<T> {
    return this.request<T>('GET', path, apiKey, undefined);
  }

  async post<T = unknown>(path: string, apiKey: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, apiKey, body);
  }

  private async request<T>(
    method: string,
    path: string,
    apiKey: string,
    body: unknown,
  ): Promise<T> {
    const url = `${SILA_SY_BASE_URL}/${path.replace(/^\//, '')}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        ...(body != null ? { body: JSON.stringify(body) } : {}),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Sila-SY ${method} ${path} network error: ${msg}`);
      throw new SilaSyApiError(`Sila-SY unreachable: ${msg}`);
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new SilaSyApiError(
        `Sila-SY returned non-JSON (HTTP ${res.status}).`,
        res.status,
      );
    }

    const record =
      json && typeof json === 'object' ? (json as Record<string, unknown>) : null;

    // Sila envelope: { success: bool, data, error, request_id }
    if (record?.success === false) {
      const errorObj =
        record.error && typeof record.error === 'object'
          ? (record.error as Record<string, unknown>)
          : null;
      const message =
        (typeof errorObj?.message === 'string' && errorObj.message.trim()) ||
        (typeof errorObj?.code === 'string' && `Sila-SY error: ${errorObj.code}`) ||
        'Sila-SY request failed.';
      throw new SilaSyApiError(message, res.status, json);
    }

    if (!res.ok) {
      // 401/403 without envelope
      if (res.status === 401 || res.status === 403) {
        throw new SilaSyApiError(
          'Invalid API key. Check that your X-API-Key starts with "sila_live_" and is correct.',
          res.status,
          json,
        );
      }
      throw new SilaSyApiError(`Sila-SY HTTP ${res.status}`, res.status, json);
    }

    // Return the inner `data` object when present, else the full response
    if (record && 'data' in record) {
      return record.data as T;
    }
    return json as T;
  }
}
