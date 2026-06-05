import { test, expect } from '@playwright/test';

import { STAGING } from '../helpers/constants';

/** Use direct API so X-Forwarded-For is honored for per-IP throttling tests. */
const API = STAGING.apiDirect.replace(/\/$/, '');

function isolatedIp(): string {
  return `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
}

test.describe('Login brute-force protection', () => {
  test('internal login returns 429 after five failed attempts per IP', async ({ request }) => {
    const ip = isolatedIp();
    const headers = { 'X-Forwarded-For': ip };

    for (let i = 0; i < 5; i++) {
      const res = await request.post(`${API}/api/auth/login`, {
        headers,
        data: { email: 'superadmin@emdad.example', password: `wrong-${i}` },
      });
      expect(res.status(), `attempt ${i + 1}`).toBe(401);
    }

    const blocked = await request.post(`${API}/api/auth/login`, {
      headers,
      data: { email: 'superadmin@emdad.example', password: 'wrong-again' },
    });
    expect(blocked.status()).toBe(429);
    const body = await blocked.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(body.error.message).toMatch(/wait/i);
  });

  test('client login returns 429 after five failed attempts per IP', async ({ request }) => {
    const ip = isolatedIp();
    const headers = { 'X-Forwarded-For': ip };

    for (let i = 0; i < 5; i++) {
      const res = await request.post(`${API}/api/client/auth/login`, {
        headers,
        data: { email: 'client@acme.example', password: `wrong-${i}` },
      });
      expect(res.status(), `attempt ${i + 1}`).toBe(401);
    }

    const blocked = await request.post(`${API}/api/client/auth/login`, {
      headers,
      data: { email: 'client@acme.example', password: 'wrong-again' },
    });
    expect(blocked.status()).toBe(429);
    const body = await blocked.json();
    expect(body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  test('successful login clears failure counter', async ({ request }) => {
    const ip = isolatedIp();
    const headers = { 'X-Forwarded-For': ip };

    for (let i = 0; i < 3; i++) {
      await request.post(`${API}/api/auth/login`, {
        headers,
        data: { email: 'superadmin@emdad.example', password: 'wrong' },
      });
    }

    const ok = await request.post(`${API}/api/auth/login`, {
      headers,
      data: { email: 'superadmin@emdad.example', password: STAGING.password },
    });
    expect(ok.status()).toBe(200);

    const after = await request.post(`${API}/api/auth/login`, {
      headers,
      data: { email: 'superadmin@emdad.example', password: 'wrong-once' },
    });
    expect(after.status()).toBe(401);
  });
});
