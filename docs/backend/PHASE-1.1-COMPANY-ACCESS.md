# Phase 1.1 — Company Access Foundation Layer

**Status:** Implemented (backend only)  
**Date:** 2026-05-19  
**Scope:** Centralized tenant/company access infrastructure. No API shape changes, no frontend, no reservation/inventory workflow logic changes, no websocket business-event changes.

---

## Summary

Introduced a global `CompanyAccessService` that resolves tenant membership from the database, validates `X-Company-Id` only as a *hint* against memberships, and provides reusable helpers for read filters, writes, and resource ownership checks. `AuthPrincipal` now carries `tenantScope` and `authorizedCompanyIds` populated on every JWT request.

---

## New components

| Path | Purpose |
|------|---------|
| `backend/src/common/company-access/company-access.service.ts` | Core tenant enforcement |
| `backend/src/common/company-access/company-access.module.ts` | `@Global()` Nest module |
| `backend/src/common/company-access/company-access.types.ts` | `TenantScopeMode`, `OwnableResource`, `AuthorizedCompanyScope` |
| `backend/src/common/company-access/index.ts` | Barrel export |
| `backend/src/common/auth/company-read-scope.ts` | `readCompanyIdFilter(companyAccess, user, query?)` |
| `backend/src/common/auth/client-auth-principal.ts` | Maps client-portal JWT → `AuthPrincipal` |
| `backend/prisma/schema.prisma` | `UserCompanyAccess` model |
| `backend/prisma/migrations/20260522120000_user_company_access/migration.sql` | Grants table |

### `CompanyAccessService` API

| Method | Role |
|--------|------|
| `resolvePrincipalTenant(userId, role, requestedCompanyId?)` | JWT pipeline: memberships + validated active tenant |
| `enrichPrincipal(base, scope)` | Attach `companyId`, `tenantScope`, `authorizedCompanyIds` |
| `getAuthorizedCompanyScope(user)` | Snapshot of current scope |
| `assertCompanyAccess(user, companyId)` | Membership check (404 on deny for restricted) |
| `assertSameCompany(user, resourceCompanyId)` | Active tenant + membership |
| `validateResourceOwnership(user, { companyId })` | Post-fetch ownership |
| `resolveWriteCompanyId(user, bodyCompanyId?)` | Creates: body id validated, must match active tenant |
| `getReadFilterCompanyId(user, queryCompanyId?)` | List filters: validates query, returns scoped id or `undefined` (all) |
| `requireActiveTenant(user, message?)` | Operations that need a selected client tenant |

### Membership rules

- **`super_admin` / `wh_manager` / `finance`** → `tenantScope: 'all'` (any active company when header selects one).
- **`wh_operator`** → `tenantScope: 'restricted'` from `user_company_access` rows plus active `Worker.companyId`.
- **Client roles** → separate client-portal JWT; mapped via `clientAuthPrincipal()` with single-company restriction.

---

## Affected modules (refactored)

### Auth / principal

- `backend/src/modules/auth/strategies/jwt.strategy.ts` — resolves tenant via `CompanyAccessService`; header renamed conceptually to validated hint.
- `backend/src/common/auth/current-user.types.ts` — `tenantScope`, `authorizedCompanyIds`.
- `backend/src/common/auth/mock-auth.middleware.ts` — mock principal includes `tenantScope: 'all'`.
- `backend/src/app.module.ts` — imports `CompanyAccessModule`.

### Orders & adjustments

- `inbound.service.ts` / `inbound.controller.ts` — `resolveWriteCompanyId`, `readCompanyIdFilter`, `findById(id, user?)` + ownership.
- `outbound.service.ts` / `outbound.controller.ts` — same pattern.
- `adjustments.service.ts` / `adjustments.controller.ts` — same pattern.

### Inventory

- `inventory.service.ts` — ownership on ledger head; write paths use `resolveWriteCompanyId`; list filters via `readCompanyIdFilter`.

### Products

- `products.service.ts` / `products.controller.ts` — create/list/nextSku and all id-based mutations pass `user` + `validateResourceOwnership`.

### Warehouse workflow

- `workflow-engine.service.ts` — inbound/outbound instance bootstrap uses `requireActiveTenant` + `validateResourceOwnership`.
- `workflow-bootstrap.service.ts` — timeline/graph/context settings use centralized tenant helpers.
- `workflow-recovery.service.ts` — instance recovery validates ownership.
- `workflow-workers.service.ts` — list/create/load/get scoped via `CompanyAccessService`.
- `warehouse-tasks.service.ts` — list filter, assign/unassign/cancel tenant asserts on workflow instance.
- `analytics-overview.controller.ts` — SQL scoped via `requireActiveTenant`.

### Client portal (adapter only)

- `client-inbound-orders.service.ts`, `client-outbound-orders.service.ts`, `client-products.service.ts`, `client-stock.service.ts` — use `clientAuthPrincipal()`; duplicate manual `companyId !==` checks removed where `findById` now enforces ownership.

---

## Removed / consolidated duplicated logic

| Before (pattern) | After |
|------------------|--------|
| `if (!user.companyId) throw …` scattered in workflow services | `requireActiveTenant()` / `getReadFilterCompanyId()` |
| `if (!order \|\| order.companyId !== user.companyId)` | `validateResourceOwnership(user, order)` |
| `companyId: user.companyId` in Prisma filters without membership check | `getReadFilterCompanyId()` or `requireActiveTenant()` |
| `const companyId = dto.companyId` on creates (trusted body) | `resolveWriteCompanyId(user, dto.companyId)` |
| `companyIdParam ?? user.companyId` on products `next-sku` | `resolveWriteCompanyId(user, companyIdParam)` |
| Client portal duplicate ownership `if (order.companyId !== client.companyId)` | Delegated to inbound/outbound `findById(..., user)` |
| Manual `workflowInstance.companyId !== user.companyId` in several task paths | `assertTaskWorkflowTenant` → `assertSameCompany` |

---

## Remaining unsafe / follow-up areas

These were **not** in scope for Phase 1.1 or still need a later phase:

| Area | Risk | Recommendation |
|------|------|----------------|
| `locations.service.ts`, `warehouses.service.ts`, `companies.service.ts`, `users.service.ts` | `findById` without `user` / ownership | Phase 1.2: same `findById(id, user)` pattern |
| `inbound.service.ts` / `outbound.service.ts` internal `findById(id)` after confirm (no user) | Low (same id, post-transaction) | Pass `user` for consistency |
| `mock-auth.middleware.ts` | Still trusts `X-Company-Id` raw for dev | Wire through `CompanyAccessService` or document dev-only |
| `realtime-socket-auth.ts` / `realtime.gateway.ts` | Handshake `companyId` | Phase 2: align with JWT tenant resolution (explicitly out of scope here) |
| PostgreSQL RLS (`app.current_company_id`) in `products.service.ts` | Session vars not set for all internal roles consistently | Align RLS middleware with `CompanyAccessService` |
| `dashboard.service.ts` | Intentionally ignores request tenant for warehouse KPIs | Documented; revisit if per-tenant dashboard needed |
| `task-inventory-effects.service.ts` | Validates `order.companyId === companyId` param (caller-supplied) | Callers already tenant-scoped; add assert at service boundary in Phase 1.2 |
| `workflow-orchestration.service.ts` | Order vs workflow company match | Add `validateResourceOwnership` when touching orders |
| Seed data | No `user_company_access` rows for demo operators | Add seed grants for `wh_operator` test users |
| `users.service.ts` worker provisioning | Uses `actor.companyId` from session | OK if JWT enrichment is always used; audit `dto.companyId` on user create |

---

## Security rules (enforced)

1. **Never trust** body `companyId` alone — `resolveWriteCompanyId` checks membership and active tenant.
2. **Never trust** `X-Company-Id` alone — validated in `resolvePrincipalTenant` against memberships / global role.
3. **List/query `companyId`** — validated via `getReadFilterCompanyId` / `readCompanyIdFilter`.
4. **Resource by UUID** — after fetch, `validateResourceOwnership` (404 to avoid tenant enumeration).

---

## Operations

1. Apply migration: `npx prisma migrate deploy` (or `migrate dev`) in `backend/`.
2. Regenerate client: `npx prisma generate`.
3. Restart API after deploy.
4. For `wh_operator` users, insert `user_company_access` rows (or rely on linked `Worker.companyId`).

---

## Future recommendations

1. **Phase 1.2** — Extend ownership checks to locations, warehouses, users, companies admin APIs.
2. **Tenant middleware** — Set `app.current_company_id` / RLS from `AuthPrincipal` on every request, not only product catalog transactions.
3. **Deprecate mock header auth** — Single path: JWT + `CompanyAccessService`.
4. **Realtime** — Issue room tokens from server-validated `authorizedCompanyIds`, not client handshake company id.
5. **Audit logging** — Log denied `assertCompanyAccess` / cross-tenant attempts for security monitoring.
6. **Integration tests** — Matrix: role × header × resource company × expected 404/403.

---

## Files intentionally not changed

- Frontend (`frontend/`, `client-frontend/`)
- Reservation lifecycle / inventory movement algorithms
- Task execution state machines (behavior unchanged; only tenant guards added)
- WebSocket emit payloads and business event types
- Public API routes and DTO shapes
