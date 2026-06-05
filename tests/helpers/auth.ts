import type { APIRequestContext } from '@playwright/test';

import { STAGING, USERS } from './constants';

export type InternalUser = keyof typeof USERS;

export interface AuthSession {
  accessToken: string;
  user: { id: string; email: string; role: string; fullName?: string };
  cookies?: string[];
}

export async function loginInternal(
  request: APIRequestContext,
  user: InternalUser = 'superAdmin',
): Promise<AuthSession> {
  let lastError = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * attempt));
    const res = await request.post(`${STAGING.adminUrl}/api/auth/login`, {
      data: { email: USERS[user].email, password: STAGING.password },
    });
    const body = await res.json();
    if (body.success) {
      return {
        accessToken: body.data.access_token,
        user: body.data.user,
        cookies: res.headers()['set-cookie'] ? [String(res.headers()['set-cookie'])] : [],
      };
    }
    lastError = body.error?.message ?? 'unknown';
    if (!String(lastError).includes('Too Many Requests')) break;
  }
  throw new Error(`Login failed for ${USERS[user].email}: ${lastError}`);
}

export async function loginClient(request: APIRequestContext): Promise<AuthSession> {
  const res = await request.post(`${STAGING.clientUrl}/api/client/auth/login`, {
    data: { email: USERS.clientAdmin.email, password: STAGING.password },
  });
  const body = await res.json();
  if (!body.success) throw new Error(`Client login failed: ${body.error?.message}`);
  return { accessToken: body.data.access_token, user: body.data.user };
}

export function authHeaders(token: string, companyId = STAGING.companyId): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'X-Company-Id': companyId,
    'Content-Type': 'application/json',
  };
}

export async function adminApi(
  request: APIRequestContext,
  token: string,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  opts?: { data?: unknown; companyId?: string },
) {
  return request.fetch(`${STAGING.adminUrl}/api${path}`, {
    method,
    headers: authHeaders(token, opts?.companyId),
    data: opts?.data,
  });
}

export async function clientApi(
  request: APIRequestContext,
  token: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  opts?: { data?: unknown },
) {
  return request.fetch(`${STAGING.clientUrl}/api/client${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: opts?.data,
  });
}
