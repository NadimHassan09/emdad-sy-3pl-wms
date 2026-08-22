import { Injectable, Logger } from '@nestjs/common';

import type { ShippingCredentials } from '../../shipping-provider.interface';

export const BABEL_BASE_URL = 'https://www.babel-express.com/api/v1/webservice.php';

export class BabelApiError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'BabelApiError';
  }
}

@Injectable()
export class BabelExpressHttpClient {
  private readonly logger = new Logger(BabelExpressHttpClient.name);

  async post<T = unknown>(
    action: string,
    credentials: ShippingCredentials,
    body: unknown = {},
  ): Promise<T> {
    const url = `${BABEL_BASE_URL}/${action.replace(/^\//, '')}`;
    const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString(
      'base64',
    );

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body ?? {}),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Babel ${action} network error: ${msg}`);
      throw new BabelApiError(`Babel Express unreachable: ${msg}`);
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new BabelApiError(
        `Babel Express returned non-JSON (HTTP ${res.status}).`,
        res.status,
      );
    }

    const record = json && typeof json === 'object' ? (json as Record<string, unknown>) : null;
    if (record?.status === 'error') {
      const errorMessage =
        typeof record.errorMessage === 'string' && record.errorMessage.trim()
          ? record.errorMessage.trim()
          : 'Babel Express request failed.';
      throw new BabelApiError(errorMessage, res.status, json);
    }

    if (!res.ok) {
      throw new BabelApiError(
        `Babel Express HTTP ${res.status}`,
        res.status,
        json,
      );
    }

    return json as T;
  }
}
