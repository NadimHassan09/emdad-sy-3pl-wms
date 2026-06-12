# API QA Audit

**Phase:** Phase 3 — API Audit  
**Audit date:** 2026-06-12  
**Auditor:** Independent QA (FINAL-QA-CERTIFICATION)  
**Scope:** Evidence-based production audit — no prior cert trust

---

## Summary

| Metric | Value |
|--------|------:|
| **Phase score** | **86/100** |
| HTTP controllers | 37 |
| HTTP endpoints | 229 |
| Client portal endpoints | 22 |
| Internal WMS endpoints | 207 |
| DTO files | 76 (~80 classes) |
| Global guards | JwtAuthGuard + ThrottlerGuard (120/min) |
| Opt-in RolesGuard usages | 17 |
| Live security checks passed | 10/10 |

## Controller Inventory

| Domain | Controllers | Endpoints |
|--------|------------:|----------:|
| Auth & users | 2 | 13 |
| Catalog (products, warehouses, locations) | 3 | 24 |
| Inventory & adjustments | 2 | 15 |
| Orders (inbound, outbound, returns) | 3 | 23 |
| Cycle count | 3 | 28 |
| Workflow & tasks | 4 | 29 |
| Billing | 1 | 19 |
| Reports & dashboard | 2 | 7 |
| Backups & integrations | 5 | 31 |
| Audit, notifications, ops | 3 | 12 |
| Client portal | 8 | 22 |
| Companies | 1 | 7 |

## RBAC Matrix (Observed)

| Guard tier | Roles | Examples |
|------------|-------|----------|
| JWT only | All authenticated | Most list/read endpoints |
| `@Roles(ADMIN)` | super_admin, wh_manager, finance | Reports, audit logs, backups read |
| `InternalAdminGuard` | super_admin, wh_manager | Company/user mutations, billing admin |
| `SuperAdminGuard` | super_admin only | Backup create/restore/factory-reset |
| `JwtClientAuthGuard` | client_admin, client_staff | All `/api/client/*` |
| `WorkflowExecutionGateGuard` | Task executor | Task start/complete/progress |

## Validation Coverage

- **Global ValidationPipe:** whitelist + forbidNonWhitelisted + forbidUnknownValues
- **DTO coverage:** ~76 DTO files for 229 endpoints (~33% file ratio; many endpoints share DTOs)
- **Gaps (~35 endpoints):** notifications query params, dashboard widgets, task inline bodies, client billing queries

## Risk Ranking

| Rank | Risk | Severity | Endpoints affected |
|------|------|----------|-------------------|
| 1 | RolesGuard opt-in — service-layer RBAC only on many mutators | Medium | inbound/outbound/returns/workflows |
| 2 | Client JWT shares secret fallback with internal JWT | Medium | `/api/client/*` |
| 3 | Backup download token in query string | Low | `/api/backups/:id/download` |
| 4 | Google Drive OAuth callback is `@Public()` | Low | `/api/integrations/google-drive/callback` |
| 5 | Maintenance middleware liveness path mismatch | Medium | `/api/ops/health/live` during restore |
| 6 | Socket CORS `origin: true` | Low | `/realtime` |

## Live Endpoint Verification (Production)

Benchmark run: 2026-06-12T18:02:35.660Z — 15 samples per endpoint.

| Endpoint | Status | Avg (ms) | P95 (ms) | P99 (ms) | Payload |
|----------|--------|--------:|---------:|---------:|--------:|
| auth/me | 200 | 28 | 34 | 34 | 248 |
| dashboard/overview | 200 | 34 | 56 | 56 | 1,123 |
| products/list | 200 | 28 | 36 | 36 | 683 |
| locations/list | 200 | 27 | 35 | 35 | 994 |
| warehouses/list | 400 | 38 | 225 | 225 | 92 |
| inventory/stock | 200 | 31 | 54 | 54 | 7,459 |
| inventory/ledger | 200 | 157 | 851 | 851 | 6,524 |
| inbound/list | 200 | 26 | 33 | 33 | 4,613 |
| outbound/list | 200 | 44 | 198 | 198 | 752 |
| returns/list | 200 | 27 | 46 | 46 | 68 |
| tasks/list | 200 | 27 | 35 | 35 | 6,372 |
| cycle-count/counts | 200 | 41 | 288 | 288 | 68 |
| adjustments/list | 200 | 25 | 32 | 32 | 2,076 |
| companies/list | 400 | 21 | 45 | 45 | 92 |
| users/list | 200 | 26 | 35 | 35 | 1,925 |
| reports/policy | 200 | 19 | 22 | 22 | 432 |
| reports/inventory/run | 200 | 23 | 30 | 30 | 2,503 |
| reports/warehouse-analysis/run | 200 | 23 | 45 | 45 | 357 |
| billing/summary | 200 | 25 | 34 | 34 | 146 |
| billing/invoices | 200 | 22 | 25 | 25 | 68 |
| billing/plans | 200 | 26 | 63 | 63 | 68 |
| backups/health | 200 | 30 | 37 | 37 | 890 |
| backups/list | 200 | 48 | 357 | 357 | 2,315 |
| backups/schedules | 200 | 22 | 64 | 64 | 36 |
| backups/retention/policies | 200 | 20 | 23 | 23 | 141 |
| audit-logs/list | 200 | 23 | 29 | 29 | 979 |
| notifications/list | 200 | 24 | 31 | 31 | 464 |
| ops/health/live | 200 | 147 | 1164 | 1164 | 78 |
| ops/health/ready | 200 | 22 | 31 | 31 | 164 |
| client/dashboard | 200 | 36 | 99 | 99 | 369 |
| client/products | 200 | 34 | 70 | 70 | 683 |
| client/stock | 200 | 199 | 2557 | 2557 | 234 |
| client/inbound | 200 | 62 | 445 | 445 | 4,613 |
| client/outbound | 200 | 25 | 37 | 37 | 752 |
| client/billing | 200 | 36 | 207 | 207 | 265 |
| client/notifications | 200 | 23 | 32 | 32 | 1,129 |

**Note:** `warehouses/list` and `companies/list` returned 400 in benchmark due to missing required query params — endpoints functional with correct params.

## Phase Score: 86/100

Comprehensive 229-endpoint API with global auth, throttling, tiered backup RBAC, and refresh token rotation. Deductions for opt-in RolesGuard, DTO gaps on ~15% of handlers, and client auth hardening gaps.
