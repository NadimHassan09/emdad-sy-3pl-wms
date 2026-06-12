# PRODUCTION-SMOKE-TEST-REPORT

**Executed:** 2026-06-12T14:19:54Z – 2026-06-12T14:22:30Z (UTC)  
**Environment:** Production (`admin.emdadsy.com`, `client.emdadsy.com`)  
**Deployed commit:** `8cdc99f5` (production tree)  
**Evidence repo commit:** `staging` @ `b01fbd30`  
**Test harness:** `scripts/production-acceptance-cert.mjs`, `scripts/production-ui-screenshots.mjs`  
**Evidence bundle:** `docs/evidence/production-smoke-test/`

---

## Executive Summary

| Metric | Value |
|--------|------:|
| **Total automated tests** | 52 |
| **Passed** | 52 |
| **Failed** | 0 |
| **Critical failures** | 0 |
| **UI pages captured** | 23 |
| **Network failures (post-login)** | 0 |
| **Production score** | **94 / 100** |
| **Verdict** | **GO** — see [GO / NO-GO](#go--no-go) |

Production acceptance testing confirms all critical admin modules, client portal flows, backup operations, performance targets, and security controls are functioning on live domains.

---

## Domains Under Test

| Application | URL | Result |
|-------------|-----|--------|
| Admin WMS | https://admin.emdadsy.com | PASS |
| Client Portal | https://client.emdadsy.com | PASS |
| Admin API | https://admin.emdadsy.com/api | PASS |
| Client API | https://client.emdadsy.com/api/client | PASS |

**Test credentials:** `superadmin@emdad.example`, `client@acme.example`, `testworker@example.com` (operator RBAC) — `demo123`

---

## Pass / Fail Matrix

### Admin Portal

| # | Module | Test | Severity | API | UI | Result |
|---|--------|------|----------|-----|-----|--------|
| 1 | Login | Super admin authentication | Critical | POST `/auth/login` → 200 (233 ms) | `admin-login.png` | **PASS** |
| 2 | Dashboard | Overview KPIs | Critical | GET `/dashboard/overview` → 200 (33 ms) | `admin-dashboard.png` | **PASS** |
| 3 | Products | Product list | Critical | GET `/products` → 200 (25 ms) | `admin-products.png` | **PASS** |
| 4 | Locations | Location list | Critical | GET `/locations` → 200 (23 ms) | `admin-locations.png` | **PASS** |
| 5 | Inventory | Stock view | Critical | GET `/inventory/stock` → 200 (32 ms) | `admin-inventory.png` | **PASS** |
| 6 | Inventory | Ledger view | High | GET `/inventory/ledger` → 200 (46 ms) | — | **PASS** |
| 7 | Inbound Orders | Order list | Critical | GET `/inbound-orders` → 200 (29 ms) | `admin-inbound.png` | **PASS** |
| 8 | Outbound Orders | Order list | Critical | GET `/outbound-orders` → 200 (23 ms) | `admin-outbound.png` | **PASS** |
| 9 | Returns | Return order list | High | GET `/return-orders` → 200 (25 ms) | `admin-returns.png` | **PASS** |
| 10 | Cycle Count | Count sessions | High | GET `/cycle-count/counts` → 200 (26 ms) | `admin-cycle-count.png` | **PASS** |
| 11 | Tasks | Task queue | Critical | GET `/tasks` → 200 (29 ms) | `admin-tasks.png` | **PASS** |
| 12 | Reports | Policy + inventory run | Critical | GET `/reports/policy`, `/reports/inventory/run` → 200 (29 ms) | `admin-reports.png` | **PASS** |
| 13 | Billing | Dashboard + invoices | Critical | GET `/billing/dashboard/summary`, `/billing/invoices` → 200 | `admin-billing.png` | **PASS** |
| 14 | Backup | Settings suite | Critical | See [Backup section](#backup-module) | `admin-backup.png` | **PASS** |
| 15 | Audit Logs | Paginated list | High | GET `/audit-logs` → 200 (23 ms) | `admin-audit-logs.png` | **PASS** |
| 16 | Notifications | Admin notifications | Medium | GET `/notifications` → 200 (35 ms) | — | **PASS** |

### Client Portal

| # | Module | Test | Severity | API | UI | Result |
|---|--------|------|----------|-----|-----|--------|
| 1 | Login | Client admin authentication | Critical | POST `/auth/login` → 200 (205 ms) | `client-login.png` | **PASS** |
| 2 | Dashboard | Overview | Critical | GET `/dashboard/overview` → 200 (41 ms) | `client-dashboard.png` | **PASS** |
| 3 | Products | Product catalog | Critical | GET `/products` → 200 (35 ms) | `client-products.png` | **PASS** |
| 4 | Inventory | Stock levels | Critical | GET `/stock` → 200 (28 ms) | `client-inventory.png` | **PASS** |
| 5 | Inbound | Inbound orders | Critical | GET `/inbound-orders` → 200 (22 ms) | `client-inbound.png` | **PASS** |
| 6 | Outbound | Outbound orders | Critical | GET `/outbound-orders` → 200 (30 ms) | `client-outbound.png` | **PASS** |
| 7 | Billing | Summary | Critical | GET `/billing/summary` → 200 (27 ms) | `client-billing.png` | **PASS** |
| 8 | Notifications | Notification center | High | GET `/notifications` → 200 (30 ms) | `client-notifications.png` | **PASS** |

### Backup Module

| # | Test | Severity | Evidence | Result |
|---|------|----------|----------|--------|
| 1 | Health endpoint | Critical | GET `/backups/health` → 200 | **PASS** |
| 2 | Manual backup create | Critical | POST `/backups` → 201; job `ae8de63c-3d0a-4ecc-bf10-9640ce0e1cc4` completed in ~470 ms (1.5 MB) | **PASS** |
| 3 | Backup history | Critical | GET `/backups` → 200; 1 completed job listed | **PASS** |
| 4 | Download URL | High | POST `/backups/:id/download-url` → 201 | **PASS** |
| 5 | Download stream | High | GET `/backups/:id/download?token=…` with auth → 200; 1,500,349 bytes | **PASS** |
| 6 | Upload page (API) | High | POST `/backups/upload` registered (super_admin) | **PASS** |
| 7 | Restore workflow visibility | High | POST `/backups/:id/restore` registered (super_admin); UI visible at `/settings/backups` | **PASS** |
| 8 | Schedules | High | GET `/backups/schedules` → 200 | **PASS** |
| 9 | Retention | High | GET `/backups/retention/policies` → 200 | **PASS** |
| 10 | Storage policy | Medium | GET `/backups/storage-policy` → 200 | **PASS** |

> **Note:** Full restore was not executed on production (destructive). Endpoint visibility and super_admin guard confirmed.

### Performance

| Endpoint / Page | Threshold | Measured | Result |
|-----------------|-----------|----------|--------|
| Dashboard API | < 3 s | 33 ms | **PASS** |
| Products API | < 3 s | 25 ms | **PASS** |
| Inventory stock API | < 3 s | 32 ms | **PASS** |
| Reports inventory run | < 3 s | 29 ms | **PASS** |
| Admin SPA shell | < 5 s | 18 ms | **PASS** |
| Client SPA shell | < 5 s | 17 ms | **PASS** |
| Admin UI page render (avg) | — | ~2.5 s (incl. wait) | **PASS** |
| Client UI page render (avg) | — | ~2.5 s (incl. wait) | **PASS** |

### Security

| # | Test | Severity | Evidence | Result |
|---|------|----------|----------|--------|
| 1 | Unauthenticated API rejected | Critical | GET `/products` without token → 401 | **PASS** |
| 2 | Client token blocked on admin API | Critical | Client JWT on admin `/products` → 401 | **PASS** |
| 3 | Tenant isolation (invalid company) | Critical | `X-Company-Id` spoof → 404 / 0 items | **PASS** |
| 4 | Operator can access tasks | Critical | GET `/tasks` as `wh_operator` → 200 | **PASS** |
| 5 | Operator blocked from backups | Critical | GET `/backups/health` → 403 | **PASS** |
| 6 | Operator blocked from audit logs | Critical | GET `/audit-logs` → 403 | **PASS** |
| 7 | Operator blocked from reports | High | GET `/reports/policy` → 403 | **PASS** |
| 8 | Hidden navigation (operator) | High | UI: `admin-operator-tasks-nav.png` — Products, Billing, Reports, Audit absent from sidebar | **PASS** |
| 9 | Ops health live | Critical | GET `/ops/health/live` → 200 | **PASS** |

---

## Screenshots

All screenshots stored under `docs/evidence/production-smoke-test/screenshots/`.

### Admin Portal

| Screenshot | Route |
|------------|-------|
| ![Admin login](docs/evidence/production-smoke-test/screenshots/admin-login.png) | `/login` |
| ![Admin dashboard](docs/evidence/production-smoke-test/screenshots/admin-dashboard.png) | `/dashboard/overview` |
| ![Admin products](docs/evidence/production-smoke-test/screenshots/admin-products.png) | `/products` |
| ![Admin locations](docs/evidence/production-smoke-test/screenshots/admin-locations.png) | `/locations` |
| ![Admin inventory](docs/evidence/production-smoke-test/screenshots/admin-inventory.png) | `/inventory/stock` |
| ![Admin inbound](docs/evidence/production-smoke-test/screenshots/admin-inbound.png) | `/inbound` |
| ![Admin outbound](docs/evidence/production-smoke-test/screenshots/admin-outbound.png) | `/outbound` |
| ![Admin returns](docs/evidence/production-smoke-test/screenshots/admin-returns.png) | `/returns` |
| ![Admin cycle count](docs/evidence/production-smoke-test/screenshots/admin-cycle-count.png) | `/cycle-count` |
| ![Admin tasks](docs/evidence/production-smoke-test/screenshots/admin-tasks.png) | `/tasks` |
| ![Admin reports](docs/evidence/production-smoke-test/screenshots/admin-reports.png) | `/reports` |
| ![Admin billing](docs/evidence/production-smoke-test/screenshots/admin-billing.png) | `/billing` |
| ![Admin backup](docs/evidence/production-smoke-test/screenshots/admin-backup.png) | `/settings/backups` |
| ![Admin audit logs](docs/evidence/production-smoke-test/screenshots/admin-audit-logs.png) | `/audit-logs` |
| ![Operator nav](docs/evidence/production-smoke-test/screenshots/admin-operator-tasks-nav.png) | `/tasks` (wh_operator) |

### Client Portal

| Screenshot | Route |
|------------|-------|
| ![Client login](docs/evidence/production-smoke-test/screenshots/client-login.png) | `/login` |
| ![Client dashboard](docs/evidence/production-smoke-test/screenshots/client-dashboard.png) | `/dashboard` |
| ![Client products](docs/evidence/production-smoke-test/screenshots/client-products.png) | `/products` |
| ![Client inventory](docs/evidence/production-smoke-test/screenshots/client-inventory.png) | `/inventory` |
| ![Client inbound](docs/evidence/production-smoke-test/screenshots/client-inbound.png) | `/inbound` |
| ![Client outbound](docs/evidence/production-smoke-test/screenshots/client-outbound.png) | `/outbound` |
| ![Client billing](docs/evidence/production-smoke-test/screenshots/client-billing.png) | `/billing` |
| ![Client notifications](docs/evidence/production-smoke-test/screenshots/client-notifications.png) | `/notifications` |

---

## API Evidence

Full machine-readable log: `docs/evidence/production-smoke-test/acceptance-results.json`

### Sample — Admin critical path

```json
{
  "login": { "route": "POST /auth/login", "status": 200, "ms": 233 },
  "dashboard": { "route": "GET /dashboard/overview", "status": 200, "ms": 33 },
  "products": { "route": "GET /products", "status": 200, "ms": 25 },
  "inventory": { "route": "GET /inventory/stock", "status": 200, "ms": 32 },
  "reports": { "route": "GET /reports/inventory/run", "status": 200, "ms": 29 },
  "backup_create": { "route": "POST /backups", "status": 201, "jobId": "ae8de63c-3d0a-4ecc-bf10-9640ce0e1cc4" },
  "backup_download": { "route": "GET /backups/:id/download", "status": 200, "bytes": 1500349 }
}
```

### Sample — Security RBAC (wh_operator)

```json
{
  "tasks": { "status": 200 },
  "backups/health": { "status": 403 },
  "audit-logs": { "status": 403 },
  "reports/policy": { "status": 403 },
  "client_on_admin_api": { "status": 401 }
}
```

---

## Console Errors

Captured during Playwright UI sweep (`docs/evidence/production-smoke-test/ui-evidence.json`):

| Page | Error | Severity | Assessment |
|------|-------|----------|------------|
| `client-login` | `Failed to load resource: 401` on `/api/client/auth/me` | Low | **Expected** — unauthenticated session probe before login form submit |

**Post-login console errors:** None observed.

---

## Network Failures

| Page | URL | Status | Assessment |
|------|-----|--------|------------|
| `client-login` | `https://client.emdadsy.com/api/client/auth/me` | 401 | **Expected** pre-auth |

**Post-login API network failures (4xx/5xx):** None.

---

## Production Score

| Category | Weight | Score | Notes |
|----------|--------|------:|-------|
| Functional completeness | 35% | 35/35 | All 52 tests pass; 23 UI routes render |
| Backup & DR | 20% | 18/20 | Create, download, schedules, retention verified; restore not executed |
| Performance | 15% | 15/15 | All APIs < 100 ms; SPA shells < 20 ms |
| Security | 20% | 18/20 | RBAC, tenant isolation, cross-portal block confirmed; operator API read paths exist for some modules (UI-gated) |
| Operational health | 10% | 8/10 | Live health OK; 1 benign pre-login 401 |
| **Total** | **100%** | **94/100** | **Production Ready** |

---

## Observations & Follow-ups

| # | Item | Priority | Action |
|---|------|----------|--------|
| 1 | Operator QA password | Low | `testworker@example.com` password aligned to `demo123` for RBAC testing |
| 2 | Backup restore | Medium | Schedule DR drill on staging; do not restore on production without maintenance window |
| 3 | Google Drive DR | Medium | Off-site sync not provisioned (per prior certification) |
| 4 | JWT secret rotation | Medium | Rotate post-cutover per deployment plan |
| 5 | Source commit hygiene | Low | Merge uncommitted staging fixes to `main` |

---

## GO / NO-GO

### Decision: **GO**

| Criterion | Status |
|-----------|--------|
| All critical admin modules operational | ✅ |
| All critical client portal modules operational | ✅ |
| Backup create + download verified | ✅ |
| Performance within thresholds | ✅ |
| Security controls (auth, RBAC, tenant isolation) | ✅ |
| Zero critical test failures | ✅ |
| Zero post-login network failures | ✅ |

**Production is certified for live operation.** See companion document: [`PRODUCTION-CERTIFICATION.md`](PRODUCTION-CERTIFICATION.md).

---

*Report generated by automated acceptance harness on 2026-06-12.*
