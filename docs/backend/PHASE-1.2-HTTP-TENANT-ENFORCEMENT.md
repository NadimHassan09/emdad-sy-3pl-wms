# Phase 1.2 — HTTP Tenant Enforcement

**Status:** Implemented (backend HTTP layer)  
**Date:** 2026-05-19  
**Builds on:** [PHASE-1.1-COMPANY-ACCESS.md](./PHASE-1.1-COMPANY-ACCESS.md)  
**Scope:** HTTP API tenant isolation only. No websocket, reservation lifecycle, inventory movement algorithms, or task execution workflow changes.

---

## Summary

Extended Phase 1.1 `CompanyAccessService` usage across remaining HTTP handlers so company-scoped resources always pass through membership checks and ownership validation. `findById` on tenant-owned entities now **requires** `AuthPrincipal` and returns 404 on cross-tenant access.

---

## Fixed endpoints (by module)

### Orders

| Endpoint | Fix |
|----------|-----|
| `GET /inbound-orders/:id` | `findById(id, user)` — ownership required |
| `POST /inbound-orders/:id/confirm` | Post-commit reads + `receiveLine` validate order ownership |
| `GET /outbound-orders/:id` | Same as inbound |
| `POST /outbound-orders/:id/confirm` | `confirmAndDeduct` / `confirmWithoutDeduction` validate before + inside transactions |

### Adjustments

| Endpoint | Fix |
|----------|-----|
| `GET /adjustments/:id` | `findById` requires `user`; always validates `stockAdjustment.companyId` |

### Products

| Endpoint | Fix |
|----------|-----|
| `GET /products/:id` (+ mutations) | `findById(id, user)` required; list/create/next-sku use centralized company resolution (Phase 1.1 + tightened `findById`) |

### Inventory

| Endpoint | Fix |
|----------|-----|
| `GET /inventory/*` | `readCompanyIdFilter` / `resolveWriteCompanyId` / `validateResourceOwnership` on ledger entry (Phase 1.1; verified) |
| `GET /inventory/availability` | Query `companyId` via `resolveWriteCompanyId` |

### Tasks / workflow (HTTP read paths only)

| Endpoint | Fix |
|----------|-----|
| `GET /workflows/instances/:id/graph` | `validateResourceOwnership` on workflow instance (re-applied) |
| `GET /workflows/references/...` | `requireActiveTenant` + scoped queries |
| `POST /workflows/instances/:id/recover` | Removed raw `user.companyId` gate; uses ownership validation |
| `GET /analytics/overview` | SQL scoped to `requireActiveTenant` (both queries) |

### Clients (companies)

| Endpoint | Fix |
|----------|-----|
| `GET /companies` | Restricted principals: `id IN authorizedCompanyIds` |
| `GET /companies/:id` | `assertCompanyAccess` before fetch |
| `PATCH /companies/:id`, suspend, close, delete | `assertCompanyAccess` on target id |

### Users

| Endpoint | Fix |
|----------|-----|
| `GET /users` | Restricted: client users limited to `authorizedCompanyIds`; `kind=all` uses OR (system + authorized clients) |
| `GET /users/:id` | `assertCompanyAccess` when target has `companyId` |
| `POST /users` | Client create: `resolveWriteCompanyId`; worker provision: `requireActiveTenant` |
| `PATCH /users/:id`, suspend, delete | Assert access to existing + new `companyId` |

### Client portal (HTTP adapters)

| Endpoint | Fix |
|----------|-----|
| Client inbound/outbound/products/stock | `clientAuthPrincipal()` + delegated service ownership (Phase 1.1) |

---

## Authorization improvements

1. **Mandatory ownership on `findById`** — `inbound`, `outbound`, `adjustments`, `products` no longer allow optional `user`; HTTP paths always pass the principal.
2. **Confirm/receive paths** — Order mutations re-validate `companyId` inside transactions, not only on the initial read.
3. **Company admin APIs** — List/filter and per-id mutations respect `tenantScope` / `authorizedCompanyIds`.
4. **User admin APIs** — Cannot assign or read client users outside authorized tenants; worker rows use validated active tenant, not raw header alone.
5. **Consistent 404** — Cross-tenant resource access uses `NotFoundException` via `validateResourceOwnership` / `assertCompanyAccess`.

---

## Removed / avoided frontend-trusted patterns

| Pattern | Replacement |
|---------|-------------|
| `findById(id)` without user on orders/adjustments/products | `findById(id, user)` + `validateResourceOwnership` |
| `if (order.companyId !== user.companyId)` ad hoc checks | `CompanyAccessService.validateResourceOwnership` |
| `dto.companyId` on client user create | `resolveWriteCompanyId(actor, dto.companyId)` |
| `actor.companyId!` for worker provisioning | `requireActiveTenant(actor)` |
| Unscoped `GET /companies` for restricted operators | `where.id IN authorizedCompanyIds` |
| Analytics SQL using stale `user.companyId` in one query | Both queries use `tenantCompanyId` from `requireActiveTenant` |

---

## Remaining risky / out-of-scope areas

| Area | Notes |
|------|--------|
| **Warehouses** (`/warehouses/*`) | Shared 3PL infrastructure — no `company_id` on `warehouses`. Any authenticated internal user can read/update. Acceptable for single-warehouse ops; add role guards in a future phase if needed. |
| **Locations** (`/locations/*`) | Same — physical layout is warehouse-scoped, not tenant-scoped. Stock *at* locations is tenant-filtered via `/inventory/*`. |
| **Dashboard** (`/dashboard/overview`) | Warehouse-wide KPIs intentionally aggregate all clients (see comments in `dashboard.service.ts`). Not suitable for strict per-tenant dashboard without product changes. |
| **WebSocket / realtime** | Explicitly excluded — handshake `companyId` not validated here. |
| **`mock-auth.middleware.ts`** | Dev-only; still sets `companyId` from header without membership lookup. |
| **`workflow-orchestration.service.ts`** | Internal transactional orchestration; order↔workflow consistency checks unchanged (not HTTP). |
| **`task-inventory-effects.service.ts`** | Caller-supplied `companyId`; callers are already tenant-scoped task paths. |
| **Company create** (`POST /companies`) | Still creates global client records (admin capability); no tenant filter on create by design. |
| **Shipments** | No shipment module in codebase — N/A. |

---

## Files changed (Phase 1.2)

- `backend/src/modules/inbound/inbound.service.ts`
- `backend/src/modules/outbound/outbound.service.ts`
- `backend/src/modules/adjustments/adjustments.service.ts`
- `backend/src/modules/products/products.service.ts`
- `backend/src/modules/companies/companies.service.ts`
- `backend/src/modules/companies/companies.controller.ts`
- `backend/src/modules/users/users.service.ts`
- `backend/src/modules/users/users.controller.ts`
- `backend/src/modules/warehouse-workflow/workflow-bootstrap.service.ts`
- `backend/src/modules/warehouse-workflow/workflow-recovery.service.ts`
- `backend/src/modules/warehouse-workflow/analytics-overview.controller.ts`

---

## Verification

```powershell
cd backend
npx tsc --noEmit
```

Restart the API after deploy: `npm run start:dev`

---

## Future recommendations (Phase 1.3+)

1. Add `@Roles(AuthGroup.ADMIN)` on warehouse/location **mutations** if operators should be read-only on master data.
2. Tenant-scoped dashboard mode (`?companyId=` validated) alongside warehouse-wide mode.
3. Wire `mock-auth` through `CompanyAccessService.resolvePrincipalTenant`.
4. HTTP integration tests: cross-tenant `GET` by UUID returns 404 for each resource type.
