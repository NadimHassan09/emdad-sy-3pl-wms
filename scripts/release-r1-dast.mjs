#!/usr/bin/env node
/**
 * RELEASE-R1 — Lightweight DAST-style checks against staging (OWASP ZAP substitute).
 * Writes JSON evidence to docs/evidence/release-r1-dast/
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const ADMIN = process.env.ADMIN_BASE_URL ?? 'https://staging-admin.emdadsy.com';
const CLIENT = process.env.CLIENT_BASE_URL ?? 'https://staging-client.emdadsy.com';
const API = process.env.STAGING_API_DIRECT ?? 'http://127.0.0.1:3001';
const API_BASE = `${API.replace(/\/$/, '')}/api`;
const OUT = join(ROOT, 'docs/evidence/release-r1-dast');

const PASSWORD = process.env.DAST_PASSWORD ?? 'demo123';

function sev(ok, warn = false) {
  if (ok) return { severity: 'PASS', status: 'pass' };
  if (warn) return { severity: 'LOW', status: 'warn' };
  return { severity: 'MEDIUM', status: 'fail' };
}

async function fetchProbe(name, url, opts = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    return {
      name,
      url,
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      bodySample: text.slice(0, 500),
      ms: Date.now() - started,
    };
  } catch (err) {
    return { name, url, error: String(err.message ?? err), ms: Date.now() - started };
  }
}

function checkSecurityHeaders(probe) {
  const h = probe.headers ?? {};
  const checks = [
    {
      id: 'x-content-type-options',
      ok: (h['x-content-type-options'] ?? '').toLowerCase() === 'nosniff',
      detail: h['x-content-type-options'] ?? '(missing)',
    },
    {
      id: 'x-frame-options',
      ok: Boolean(h['x-frame-options']),
      detail: h['x-frame-options'] ?? '(missing)',
    },
    {
      id: 'referrer-policy',
      ok: Boolean(h['referrer-policy']),
      detail: h['referrer-policy'] ?? '(missing)',
    },
    {
      id: 'strict-transport-security',
      ok: Boolean(h['strict-transport-security']),
      detail: h['strict-transport-security'] ?? '(missing on HTTPS — verify reverse proxy)',
      warn: !h['strict-transport-security'],
    },
    {
      id: 'content-security-policy',
      ok: Boolean(h['content-security-policy']),
      detail: h['content-security-policy'] ?? '(missing — SPA may rely on nginx CSP)',
      warn: !h['content-security-policy'],
    },
  ];
  return checks.map((c) => ({ ...c, ...sev(c.ok, c.warn) }));
}

function parseSetCookies(headers) {
  const raw = headers?.['set-cookie'];
  if (!raw) return [];
  return String(raw).split(/,(?=[^;]+=)/g).map((s) => s.trim());
}

function checkCookieSecurity(setCookies, label) {
  const findings = [];
  for (const cookie of setCookies) {
    const name = cookie.split('=')[0];
    const lower = cookie.toLowerCase();
    findings.push({
      cookie: name,
      portal: label,
      httpOnly: lower.includes('httponly'),
      secure: lower.includes('secure'),
      sameSite: /samesite=(\w+)/i.exec(cookie)?.[1]?.toLowerCase() ?? '(none)',
      path: /path=([^;]+)/i.exec(cookie)?.[1] ?? '/',
    });
  }
  return findings;
}

async function loginCookies(url, path, email) {
  const res = await fetch(`${url}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const text = await res.text();
  return {
    status: res.status,
    setCookies: parseSetCookies(Object.fromEntries(res.headers.entries())),
    bodyOk: text.includes('"success":true'),
  };
}

async function bruteForceProbe() {
  const ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
  const headers = {
    'Content-Type': 'application/json',
    'X-Forwarded-For': ip,
  };
  let lastStatus = 0;
  let lastBody = null;
  for (let i = 0; i < 6; i++) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: 'superadmin@emdad.example', password: `bad-${i}` }),
    });
    lastStatus = res.status;
    lastBody = await res.json().catch(() => null);
  }
  return {
    ip,
    sixthStatus: lastStatus,
    sixthCode: lastBody?.error?.code ?? null,
    ok: lastStatus === 429 && lastBody?.error?.code === 'TOO_MANY_REQUESTS',
  };
}

async function csrfOriginProbe() {
  const evilOrigin = 'https://evil.example';
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: {
      Origin: evilOrigin,
      'Content-Type': 'application/json',
    },
  });
  return {
    evilOrigin,
    status: res.status,
    blocked: res.status === 403 || res.status === 401,
    note: 'Refresh without cookie should fail; CORS blocks browser cross-origin reads',
  };
}

async function xssProbe() {
  const payload = '<script>alert(1)</script>';
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: payload, password: 'x' }),
  });
  const text = await res.text();
  return {
    reflectedRaw: text.includes(payload),
    status: res.status,
    ok: !text.includes(payload),
  };
}

async function openRedirectProbe() {
  const targets = [
    `${ADMIN}/login?next=https://evil.example`,
    `${CLIENT}/login?redirect=https://evil.example`,
    `${ADMIN}/?returnUrl=//evil.example`,
  ];
  const results = [];
  for (const url of targets) {
    const res = await fetch(url, { redirect: 'manual' });
    const loc = res.headers.get('location') ?? '';
    results.push({
      url,
      status: res.status,
      location: loc,
      ok: !/evil\.example/i.test(loc),
    });
  }
  return results;
}

async function sensitiveDataProbe(token) {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  return {
    status: res.status,
    containsPasswordHash: /passwordHash/i.test(text),
    containsRefreshSecret: /refresh_token/i.test(text) && res.status === 200,
    ok: res.status === 200 && !/passwordHash/i.test(text),
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  const adminHome = await fetchProbe('admin-home', ADMIN);
  const clientHome = await fetchProbe('client-home', CLIENT);
  const headerChecks = [
    ...checkSecurityHeaders(adminHome).map((c) => ({ surface: 'admin', ...c })),
    ...checkSecurityHeaders(clientHome).map((c) => ({ surface: 'client', ...c })),
  ];

  const internalLogin = await loginCookies(API_BASE.replace(/\/api$/, ''), '/api/auth/login', 'superadmin@emdad.example');
  const clientLogin = await loginCookies(API_BASE.replace(/\/api$/, ''), '/api/client/auth/login', 'client@acme.example');

  const cookieChecks = [
    ...checkCookieSecurity(internalLogin.setCookies, 'internal'),
    ...checkCookieSecurity(clientLogin.setCookies, 'client'),
  ];

  const brute = await bruteForceProbe();
  const csrf = await csrfOriginProbe();
  const xss = await xssProbe();
  const redirects = await openRedirectProbe();

  let token = null;
  if (internalLogin.bodyOk) {
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'superadmin@emdad.example', password: PASSWORD }),
    });
    const body = await loginRes.json();
    token = body?.data?.access_token ?? null;
  }
  const sensitive = token ? await sensitiveDataProbe(token) : { ok: false, note: 'login failed' };

  const findings = [];

  for (const h of headerChecks.filter((c) => c.status !== 'pass')) {
    findings.push({
      category: 'Header security',
      id: h.id,
      severity: h.severity,
      detail: `${h.surface}: ${h.detail}`,
      fix: h.warn ? 'Confirm nginx/proxy adds header if absent at app edge' : 'Enable via helmet or reverse proxy',
    });
  }

  for (const c of cookieChecks) {
    if (!c.httpOnly) {
      findings.push({
        category: 'Cookie security',
        id: `${c.cookie}-httponly`,
        severity: 'HIGH',
        detail: `${c.cookie} missing HttpOnly`,
        fix: 'Set httpOnly: true on auth cookies',
      });
    }
    if (c.portal === 'internal' && c.sameSite !== 'strict') {
      findings.push({
        category: 'CSRF',
        id: `${c.cookie}-samesite`,
        severity: 'MEDIUM',
        detail: `Internal ${c.cookie} SameSite=${c.sameSite}`,
        fix: 'Use SameSite=Strict for internal refresh/access cookies',
      });
    }
  }

  if (!brute.ok) {
    findings.push({
      category: 'Login protection',
      id: 'brute-force',
      severity: 'CRITICAL',
      detail: `6th failed login status=${brute.sixthStatus} code=${brute.sixthCode}`,
      fix: 'Deploy LoginBruteForceService (5 failures / minute / IP)',
    });
  }

  if (xss.reflectedRaw) {
    findings.push({
      category: 'XSS',
      id: 'reflected-login',
      severity: 'HIGH',
      detail: 'Script payload reflected in login error response',
      fix: 'Ensure JSON encoding and no HTML reflection',
    });
  }

  for (const r of redirects.filter((x) => !x.ok)) {
    findings.push({
      category: 'Open redirect',
      id: 'redirect',
      severity: 'MEDIUM',
      detail: `${r.url} → ${r.location}`,
      fix: 'Validate post-login redirect targets against allowlist',
    });
  }

  if (sensitive.ok === false && !sensitive.note) {
    findings.push({
      category: 'Sensitive data exposure',
      id: 'auth-me',
      severity: 'HIGH',
      detail: 'Profile endpoint may expose secrets',
      fix: 'Strip passwordHash and tokens from API responses',
    });
  }

  const passed = [
    brute.ok && 'Login brute-force throttle (429 / TOO_MANY_REQUESTS)',
    xss.ok && 'No reflected XSS in login JSON',
    redirects.every((r) => r.ok) && 'No open redirect on login query params',
    csrf.blocked && 'Refresh rejects unauthenticated cross-site probe',
    cookieChecks.every((c) => c.httpOnly) && 'Auth cookies HttpOnly',
    sensitive.ok !== false && 'Auth profile omits password hash',
  ].filter(Boolean);

  const scoreBase = 78;
  const critical = findings.filter((f) => f.severity === 'CRITICAL').length;
  const high = findings.filter((f) => f.severity === 'HIGH').length;
  const medium = findings.filter((f) => f.severity === 'MEDIUM').length;
  const score = Math.max(0, Math.min(100, scoreBase + (brute.ok ? 8 : -15) - high * 5 - medium * 2 + passed.length));

  const report = {
    generatedAt: new Date().toISOString(),
    targets: { ADMIN, CLIENT, API_BASE },
    headerChecks,
    cookieChecks,
    bruteForce: brute,
    csrf,
    xss,
    openRedirects: redirects,
    sensitive,
    findings,
    passed,
    securityScore: score,
  };

  writeFileSync(join(OUT, 'dast-results.json'), JSON.stringify(report, null, 2));
  writeFileSync(
    join(OUT, 'dast-summary.txt'),
    [
      `RELEASE-R1 DAST summary ${report.generatedAt}`,
      `Score: ${score}/100`,
      `Findings: ${findings.length} (critical=${critical}, high=${high}, medium=${medium})`,
      ...passed.map((p) => `PASS: ${p}`),
      ...findings.map((f) => `${f.severity} [${f.category}] ${f.id}: ${f.detail}`),
    ].join('\n'),
  );

  console.log(JSON.stringify({ score, findings: findings.length, out: OUT }, null, 2));
  process.exit(critical > 0 ? 1 : 0);
}

main();
