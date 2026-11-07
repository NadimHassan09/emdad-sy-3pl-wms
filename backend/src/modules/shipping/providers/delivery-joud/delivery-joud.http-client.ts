import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { ShippingCredentials } from '../../shipping-provider.interface';
import {
  DELIVERY_JOUD_BASE_URL,
  DELIVERY_JOUD_DEFAULT_DB,
} from './delivery-joud.constants';
import type { JoudAuthParams, JoudJsonRpcResponse } from './delivery-joud.types';

export class JoudApiError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'JoudApiError';
  }
}

/**
 * Username = login, or `login|db` when the Odoo DB is not the default.
 * Password = account password (required).
 */
export function extractJoudAuth(credentials: ShippingCredentials): JoudAuthParams {
  const rawUser = (credentials.username || '').trim();
  const password = (credentials.password || '').trim();
  if (!rawUser || !password || password.toUpperCase() === 'N/A') {
    throw new BadRequestException(
      'Delivery Joud requires login (username) and password. Optional: login|db when DB is not deliveroojoud.',
    );
  }
  let login = rawUser;
  let db = DELIVERY_JOUD_DEFAULT_DB;
  if (rawUser.includes('|')) {
    const [u, d] = rawUser.split('|', 2);
    login = (u || '').trim();
    db = (d || '').trim() || DELIVERY_JOUD_DEFAULT_DB;
  }
  if (!login) {
    throw new BadRequestException('Delivery Joud login is missing.');
  }
  return { login, password, db };
}

@Injectable()
export class DeliveryJoudHttpClient {
  private readonly logger = new Logger(DeliveryJoudHttpClient.name);

  async call<T = unknown>(
    endpoint: string,
    credentials: ShippingCredentials,
    params: Record<string, unknown> = {},
    method: 'GET' | 'POST' = 'POST',
  ): Promise<T> {
    const auth = extractJoudAuth(credentials);
    const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${DELIVERY_JOUD_BASE_URL.replace(/\/+$/, '')}${cleanPath}`;
    const body = {
      jsonrpc: '2.0',
      params: {
        ...auth,
        ...params,
      },
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      this.logger.warn(`Delivery Joud ${method} ${cleanPath} network error: ${msg}`);
      throw new JoudApiError(`Delivery Joud request failed: ${msg}`);
    }

    const text = await res.text();
    let parsed: JoudJsonRpcResponse<T> | null = null;
    if (text) {
      try {
        parsed = JSON.parse(text) as JoudJsonRpcResponse<T>;
      } catch {
        parsed = null;
      }
    }

    if (!res.ok) {
      throw new JoudApiError(
        `Delivery Joud ${method} ${cleanPath} failed (${res.status}): ${text?.slice(0, 300) || res.statusText}`,
        res.status,
        parsed ?? text,
      );
    }

    if (parsed?.error) {
      throw new JoudApiError(
        `Delivery Joud error: ${parsed.error.message || JSON.stringify(parsed.error)}`,
        res.status,
        parsed,
      );
    }

    if (parsed && 'result' in parsed) {
      return parsed.result as T;
    }

    // Some Olivery endpoints return a bare object without jsonrpc envelope.
    return (parsed ?? (text as unknown)) as T;
  }
}
