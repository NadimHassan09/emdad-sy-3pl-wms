import { Injectable, Logger } from '@nestjs/common';

export const SILA_SY_BASE_URL =
  process.env.SILA_SY_BASE_URL ||
  'https://qhdhjzyduwzqutmialgp.supabase.co/functions/v1/public-api';

const RETRYABLE_STATUS = new Set([429, 500, 503]);

export class SilaSyApiError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly body?: unknown,
    readonly code?: string,
    readonly details?: unknown,
    readonly requestId?: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'SilaSyApiError';
  }
}

export type SilaListMeta = {
  has_more?: boolean;
  page?: number;
  page_size?: number;
  total?: number;
};

export type SilaEnvelope<T> = {
  data: T;
  meta?: SilaListMeta;
  requestId?: string;
};

@Injectable()
export class SilaSyHttpClient {
  private readonly logger = new Logger(SilaSyHttpClient.name);

  async get<T = unknown>(path: string, apiKey: string): Promise<T> {
    const envelope = await this.request<T>('GET', path, apiKey, undefined);
    return envelope.data;
  }

  async getEnvelope<T = unknown>(path: string, apiKey: string): Promise<SilaEnvelope<T>> {
    return this.request<T>('GET', path, apiKey, undefined);
  }

  async post<T = unknown>(path: string, apiKey: string, body: unknown): Promise<T> {
    const envelope = await this.request<T>('POST', path, apiKey, body);
    return envelope.data;
  }

  async put<T = unknown>(path: string, apiKey: string, body?: unknown): Promise<T> {
    const envelope = await this.request<T>('PUT', path, apiKey, body ?? {});
    return envelope.data;
  }

  private async request<T>(
    method: string,
    path: string,
    apiKey: string,
    body: unknown,
    attempt = 0,
  ): Promise<SilaEnvelope<T>> {
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
    const requestId = typeof record?.request_id === 'string' ? record.request_id : undefined;
    if (requestId) {
      this.logger.debug(`Sila-SY ${method} ${path} request_id=${requestId} status=${res.status}`);
    }

    const errorObj =
      record?.success === false && record.error && typeof record.error === 'object'
        ? (record.error as Record<string, unknown>)
        : null;
    const retryAfter = readRetryAfter(res, errorObj);

    if ((record?.success === false || !res.ok) && RETRYABLE_STATUS.has(res.status) && attempt < 1) {
      const waitMs = Math.min(Math.max((retryAfter ?? 1) * 1000, 500), 15_000);
      this.logger.warn(
        `Sila-SY ${method} ${path} HTTP ${res.status} request_id=${requestId ?? 'n/a'}; retrying in ${waitMs}ms`,
      );
      await sleep(waitMs);
      return this.request<T>(method, path, apiKey, body, attempt + 1);
    }

    if (record?.success === false) {
      const code = typeof errorObj?.code === 'string' ? errorObj.code : undefined;
      const message =
        (typeof errorObj?.message === 'string' && errorObj.message.trim()) ||
        (code && `Sila-SY error: ${code}`) ||
        'Sila-SY request failed.';
      const fieldDetail = formatSilaFieldErrors(errorObj);
      throw new SilaSyApiError(
        fieldDetail ? `${message} ${fieldDetail}` : message,
        res.status,
        json,
        code,
        errorObj?.details,
        requestId,
        retryAfter,
      );
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new SilaSyApiError(
          'Invalid API key. Check that your X-API-Key starts with "sila_live_" and is correct.',
          res.status,
          json,
          undefined,
          undefined,
          requestId,
        );
      }
      throw new SilaSyApiError(
        `Sila-SY HTTP ${res.status}`,
        res.status,
        json,
        undefined,
        undefined,
        requestId,
        retryAfter,
      );
    }

    const meta =
      record?.meta && typeof record.meta === 'object'
        ? (record.meta as SilaListMeta)
        : undefined;
    if (record && 'data' in record) {
      return { data: record.data as T, meta, requestId };
    }
    return { data: json as T, meta, requestId };
  }
}

function readRetryAfter(
  res: Response,
  errorObj: Record<string, unknown> | null,
): number | undefined {
  const fromError = errorObj?.retry_after_seconds;
  if (typeof fromError === 'number' && Number.isFinite(fromError)) return fromError;
  const header = res.headers.get('retry-after') || res.headers.get('x-ratelimit-reset');
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds : undefined;
}

function formatSilaFieldErrors(errorObj: Record<string, unknown> | null): string {
  const details = errorObj?.details;
  if (!details || typeof details !== 'object') return '';
  const fields = (details as Record<string, unknown>).fields;
  if (!fields || typeof fields !== 'object') return '';
  const parts: string[] = [];
  for (const [field, messages] of Object.entries(fields as Record<string, unknown>)) {
    const text = Array.isArray(messages) ? messages.map(String).join(', ') : String(messages ?? '');
    if (text.trim()) parts.push(`${field}: ${text.trim()}`);
  }
  return parts.length ? `(${parts.join('; ')})` : '';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
