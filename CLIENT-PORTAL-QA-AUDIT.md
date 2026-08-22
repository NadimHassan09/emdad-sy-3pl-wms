# Client Portal QA Audit

**Phase:** Phase 5 — Client Portal Audit  
**Audit date:** 2026-06-12  
**Auditor:** Independent QA (FINAL-QA-CERTIFICATION)  
**Scope:** Evidence-based production audit — no prior cert trust

---

## Summary

| Metric | Value |
|--------|------:|
| **Phase score** | **87/100** |
| Routes | 12 |
| Client API controllers | 8 |
| Client API endpoints | 22 |
| Client API service files | 8 |
| React version | 19.2.5 |

## Isolation Model

| Layer | Mechanism | Verified |
|-------|-----------|----------|
| Separate SPA | `client.emdadsy.com` | ✓ |
| Separate API prefix | `/api/client/*` | ✓ |
| Separate JWT strategy | `jwt-client`, `typ: client` | ✓ |
| Tenant claim | `companyId` in JWT | ✓ |
| Login isolation | Internal rejects client roles; client rejects internal | ✓ |
| Realtime rooms | `company:{id}` scoped | Code review ✓ |

## Route & Role Matrix

| Route | client_admin | client_staff |
|-------|:--:|:--:|
| Dashboard | ✓ | ✓ |
| Products | ✓ | ✗ → redirect /stock |
| Inbound/Outbound orders | ✓ | ✓ |
| Stock | ✓ | ✓ |
| Billing | ✓ | ✗ → redirect /dashboard |
| Notifications | ✓ | ✓ |

## Dashboard Widgets (Live)

Production benchmark `client/dashboard` — **200 OK**, avg 36ms, 369 bytes payload. KPI widgets served from `ClientDashboardService`.

## Billing Visibility

- `client_admin`: full billing summary + invoice detail routes
- `client_staff`: blocked at route guard + `useClientOperationalAccess` billing gate
- Operational restriction banners implemented (billing access service)

## Live API Verification

| Endpoint | Status | Avg ms | P95 ms |
|----------|--------|-------:|-------:|
| client/dashboard | 200 | 36 | 99 |
| client/products | 200 | 34 | 70 |
| client/stock | 200 | 199 | 2557 |
| client/inbound | 200 | 62 | 445 |
| client/outbound | 200 | 25 | 37 |
| client/billing | 200 | 36 | 207 |
| client/notifications | 200 | 23 | 32 |

**Note:** `client/stock` p95 spike (2557ms) warrants monitoring under load.

## Findings

| ID | Severity | Finding |
|----|----------|---------|
| CP-01 | Medium | No layout-level RequireRouteAccess — per-route guard required for new routes |
| CP-02 | Medium | Client auth has no refresh token rotation |
| CP-03 | Low | Login `from` redirect lacks pre-RBAC check (destination guard catches) |
| CP-04 | Medium | Client/stock latency outlier under benchmark |

## Phase Score: 87/100

Strong tenant isolation with separate SPA, JWT, and API surface. Role-based billing/product restrictions work. Deductions for guard architecture maintainability and client auth session hardening.
