# Phase 6.3 — RBAC Consistency Cleanup

**Status:** Implemented  
**Date:** 2026-05-29  
**Scope:** Backend HTTP authorization consistency — guards, role boundaries, tenant list scoping. No workflow/inventory logic changes beyond access control.

---

## Summary

| Layer | Mechanism |
|-------|-----------|
| Authentication | Global `JwtAuthGuard` — deny unauthenticated (except `@Public()`) |
| Coarse groups | `@Roles(AuthGroup)` + `RolesGuard` on selected handlers |
| Management | **`InternalAdminGuard`** — `super_admin` \| `wh_manager` only |
| Tenant lists | **`requireReadTenantScope`** — global admins must send `X-Company-Id` or `companyId` |
| Client portal | Class-level `@Public()` + `JwtClientAuthGuard` on business controllers |
| Policy source | `rbac-policy.ts`, `internal-rbac.ts`, `company-read-scope.ts` |

---

## Authorization model

### Role → group (unchanged)

| Prisma role | `AuthGroup` | Management (`InternalAdminGuard`) |
|-------------|-------------|-----------------------------------|
| `wh_operator` | OPERATOR | No |
| `finance` | ADMIN | No |
| `wh_manager` | ADMIN | Yes |
| `super_admin` | ADMIN | Yes |

**Important:** `AuthGroup.ADMIN` includes **finance**. Phase 6.3 splits **management mutations** onto `InternalAdminGuard` so finance can read audit logs / analytics but cannot mutate users, companies, master data, export audit CSV, or approve stock adjustments.

### Deny-default assessment

| Concern | After Phase 6.3 |
|---------|-----------------|
| Unauthenticated HTTP | Deny (except explicit `@Public()` health + auth login) |
| Wrong coarse group | Deny where `@Roles` applied |
| Finance on management writes | Deny via `InternalAdminGuard` |
| Cross-tenant list without tenant | Deny on orders, products, adjustments, stock, ledger, tasks |
| Client routes without JWT | Deny — class-level `JwtClientAuthGuard` |

`RolesGuard` still returns `true` when no `@Roles` metadata (opt-in RBAC). Sensitive paths now use explicit guards.

---

## RBAC gaps found

### P0 — Critical

| Gap | Risk | Fix |
|-----|------|-----|
| `PATCH /api/adjustments/:id/lines/:lineId` had no `@CurrentUser()` or tenant check | Any authenticated user could edit any draft adjustment line by UUID | Pass `user`, `validateResourceOwnership` on parent adjustment |

### P1 — High

| Gap | Risk | Fix |
|-----|------|-----|
| `POST /api/workers` — JWT only | Any tenant user could create workers | `InternalAdminGuard` |
| `GET /api/ops/diagnostics` — `@Public()` | Unauthenticated process/env disclosure | JWT + `InternalAdminGuard` (health probes stay public) |
| `finance` mapped to `ADMIN` on mutations | Finance could create users, companies, products, export audit | `InternalAdminGuard` on management mutations; export also guarded in service |

### P2 — Medium (tenant)

| Gap | Risk | Fix |
|-----|------|-----|
| Global admin list APIs without `X-Company-Id` | Cross-tenant order/product/stock/task lists | `readCompanyIdFilterRequired` / `requireReadTenantScope` |

### P3 — Consistency

| Gap | Risk | Fix |
|-----|------|-----|
| Client controllers: per-route `@Public()` + guard | Easy to add an open route by omission | Class-level `@Public()` + `JwtClientAuthGuard` on client business controllers |
| Scattered role checks | Drift between controller and service | `rbac-policy.ts`, `assertInternalAdmin` in services |

### Documented / intentional (no change this phase)

| Area | Notes |
|------|-------|
| Order confirm/cancel/receive | Operators may execute floor ops (Phase 1.4 design) |
| Warehouses/locations reads | Shared infrastructure, no `company_id` on entity |
| Dashboard overview | Cross-tenant KPIs — follow-up if tenant-scoped dashboard required |
| `RolesGuard` not global | Opt-in per handler; documented in remaining risks |

---

## Fixes implemented

### 1) `InternalAdminGuard` + policy module

**Files:**
- `backend/src/common/auth/internal-admin.guard.ts`
- `backend/src/common/auth/rbac-policy.ts`
- `backend/src/common/auth/internal-rbac.ts` — `assertInternalAdmin()` for service-layer defense
- `backend/src/modules/auth/auth.module.ts` — exports guard

### 2) Tenant list scoping

**`CompanyAccessService.requireReadTenantScope()`**  
**`readCompanyIdFilterRequired()`** in `company-read-scope.ts`

Applied to list/read paths:
- Inbound / outbound / products / adjustments orders
- Inventory stock + ledger
- Warehouse task list

### 3) Endpoints secured (management)

| Module | Routes | Guard |
|--------|--------|-------|
| Users | POST, PATCH, suspend, DELETE | `InternalAdminGuard` + service `assertInternalAdmin` |
| Companies | POST, PATCH, suspend, close, DELETE | `InternalAdminGuard` |
| Products | All mutations | `InternalAdminGuard` |
| Warehouses | All mutations | `InternalAdminGuard` |
| Locations | All mutations | `InternalAdminGuard` |
| Inventory | `POST internal-transfer` | `InternalAdminGuard` |
| Adjustments | `POST approve`, `PATCH lines` | Approve: `InternalAdminGuard`; lines: tenant + user |
| Workers | `POST` | `InternalAdminGuard` |
| Workflows | `POST instances/:id/recover` | `InternalAdminGuard` |
| Audit logs | `GET export` | `InternalAdminGuard` + service assert |
| Ops | `GET diagnostics` | JWT + `InternalAdminGuard` |

### 4) Audit logs — finance read, no export

- Class-level `@Roles(ADMIN)` — finance may **list** and **view detail**
- Export — `InternalAdminGuard` (wh_manager / super_admin only)
- Archival candidates — unchanged (`super_admin` in service)

### 5) Client portal

Class-level guard on:
- `client/stock`
- `client/inbound-orders`
- `client/outbound-orders`
- `client/products`
- `client/notifications`

`client/auth` — login/logout remain `@Public()` only; `GET me` keeps route-level client JWT.

### 6) Adjustments line patch

```typescript
// Controller: @CurrentUser() user
// Service: validateResourceOwnership(user, adj)
```

---

## Endpoints secured (quick reference)

**Still public (intentional):**
- `POST /api/auth/login`, `refresh`, `logout`
- `GET /api/ops/health/live`, `GET /api/ops/health/ready`
- `POST /api/client/auth/login`, `logout`

**Now requires authentication + internal admin:**
- `GET /api/ops/diagnostics`

**Now requires tenant scope for global admins:**
- `GET /api/inbound-orders`, `/outbound-orders`, `/products`, `/adjustments`
- `GET /api/inventory/stock/*`, `/inventory/ledger/*`
- `GET /api/tasks`

---

## Remaining risks

| Risk | Severity | Mitigation path |
|------|----------|----------------|
| Opt-in `RolesGuard` — handlers without `@Roles` allow any authenticated role | Medium | Future: default-deny module metadata or global guard with explicit `@AllowOperator` |
| Operators can confirm/cancel orders and approve adjustments (except approve now internal-admin) | Low–Med | Product policy; add `@Roles` if floor staff should not confirm |
| Dashboard cross-tenant aggregates | Medium | Tenant-scoped dashboard follow-up |
| Warehouse/location GET without tenant | Low | Documented shared-infra model |
| No `client_admin` vs `client_staff` split at HTTP layer | Low | Future client RBAC if required |
| WebSocket — tenant validated at connect; no per-event role checks | Low | Event publish path review |

---

## Validation

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | Pass |

**Recommended manual checks:**
1. Finance user: can `GET /audit-logs`, cannot `GET /audit-logs/export`, cannot `POST /users`
2. Operator: cannot `POST /workers`, cannot `GET /ops/diagnostics`
3. Super admin without `X-Company-Id`: `GET /outbound-orders` → 400 tenant message
4. `PATCH /adjustments/:id/lines/:lineId` cross-tenant → 404

---

## Files changed

| Area | Files |
|------|-------|
| Policy / guards | `rbac-policy.ts`, `internal-admin.guard.ts`, `internal-rbac.ts`, `company-read-scope.ts`, `company-access.service.ts`, `auth.module.ts` |
| P0 adjustments | `adjustments.controller.ts`, `adjustments.service.ts` |
| Management controllers | `users`, `companies`, `products`, `warehouses`, `locations`, `inventory`, `workflow-workers`, `workflow`, `audit-logs`, `observability` |
| Tenant lists | `inbound`, `outbound`, `products`, `adjustments`, `inventory`, `warehouse-tasks` services |
| Client portal | `client-*` controllers (stock, inbound, outbound, products, notifications) |

---

## Related docs

- [PHASE-1.4-BACKEND-RBAC-HARDENING.md](./PHASE-1.4-BACKEND-RBAC-HARDENING.md) — initial ADMIN mutations
- [PHASE-1.2-HTTP-TENANT-ENFORCEMENT.md](./PHASE-1.2-HTTP-TENANT-ENFORCEMENT.md) — tenant on writes
- [PHASE-1.3-WEBSOCKET-TENANT-ISOLATION.md](./PHASE-1.3-WEBSOCKET-TENANT-ISOLATION.md) — realtime tenant rooms
- [SCOPE-ALIGNED-PRODUCTION-AUDIT.md](./SCOPE-ALIGNED-PRODUCTION-AUDIT.md) — RBAC gap findings
