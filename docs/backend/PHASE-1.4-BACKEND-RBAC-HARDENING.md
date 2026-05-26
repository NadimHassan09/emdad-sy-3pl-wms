# Phase 1.4 — Backend RBAC Hardening

**Status:** Implemented (backend HTTP RBAC hardening)  
**Date:** 2026-05-26  
**Builds on:** [PHASE-1.1-COMPANY-ACCESS.md](./PHASE-1.1-COMPANY-ACCESS.md), [PHASE-1.2-HTTP-TENANT-ENFORCEMENT.md](./PHASE-1.2-HTTP-TENANT-ENFORCEMENT.md), [PHASE-1.3-WEBSOCKET-TENANT-ISOLATION.md](./PHASE-1.3-WEBSOCKET-TENANT-ISOLATION.md)  
**Scope:** Server-side role-based authorization enforcement. No reservation/inventory/task/workflow logic changes; no websocket architecture changes.

---

## RBAC architecture (centralized)

The backend uses the existing coarse-grained policy layer:

1. `@Roles(...)` decorator sets required `AuthGroup` metadata.
2. `RolesGuard` enforces the policy on HTTP requests:
   - Maps Prisma `UserRole` → `AuthGroup`
   - Denies requests when the authenticated principal is not in the required group
3. **Deny-by-authorization** is achieved by adding guards to privileged endpoints (unprotected endpoints remain available, but privileged mutations are now protected).

Key mapping:
- `UserRole.wh_operator` → `AuthGroup.OPERATOR`
- `super_admin`, `wh_manager`, `finance` → `AuthGroup.ADMIN`

---

## Secured endpoints (privileged mutations)

### Companies (`/companies`)
- `POST /companies` → ADMIN only
- `PATCH /companies/:id` → ADMIN only
- `POST /companies/:id/suspend` → ADMIN only
- `POST /companies/:id/close` → ADMIN only
- `DELETE /companies/:id` already required ADMIN (existing)

### Users (`/users`)
- `POST /users` → ADMIN only
- `PATCH /users/:id` → ADMIN only
- `POST /users/:id/suspend` → ADMIN only
- `DELETE /users/:id` → ADMIN only

### Warehouses (`/warehouses`)
- `POST /warehouses` → ADMIN only
- `PATCH /warehouses/:id` → ADMIN only
- `DELETE /warehouses/:id` → ADMIN only
- `PATCH /warehouses/:id/status` → ADMIN only

### Locations (`/locations`)
- `POST /locations` → ADMIN only
- `GET /locations/purge-context` (privileged maintenance) → ADMIN only
- `PATCH /locations/:id` → ADMIN only
- `DELETE /locations/:id/permanent` → ADMIN only
- `DELETE /locations/:id` → ADMIN only

### Products (`/products`)
- `POST /products` → ADMIN only
- `GET /products/next-sku` → ADMIN only
- `POST /products/:id/suspend` → ADMIN only
- `POST /products/:id/unsuspend` → ADMIN only
- `DELETE /products/:id/hard` → ADMIN only
- `PATCH /products/:id` → ADMIN only
- `DELETE /products/:id` (archive) → ADMIN only

### Inventory (`/inventory`)
- `POST /inventory/internal-transfer` → ADMIN only

---

## Policy enforcement improvements

- Removed backend trust in “frontend role hiding” for privileged mutations:
  - Operations that modify master/config data are now guarded server-side.
- Workers/operators (`wh_operator` / `AuthGroup.OPERATOR`) can still access normal workflow APIs, but can no longer call admin mutation endpoints (master data, privileged maintenance, internal transfers).

---

## Remaining authorization gaps (by design / follow-up)

1. **Order/workflow APIs**
   - `inbound-orders`, `outbound-orders`, and `adjustments` controllers currently do not enforce `AuthGroup.ADMIN` at the controller level.
   - If “operators must not perform confirm/cancel/approve operations” becomes a requirement, these endpoints should be guarded in a follow-up.
2. **Workflow recovery**
   - `WorkflowRecoveryService` already checks `user.role` (super_admin/wh_manager) internally.
   - A controller-level guard could be added for earlier rejection (optional).
3. **Read endpoints**
   - This phase primarily protects mutations. Read endpoints (e.g., `GET /companies/:id`, `GET /warehouses/:id`) remain reachable by non-admin roles unless a follow-up specifies stricter read-level RBAC.
4. **Tenant + RBAC interplay**
   - Tenant isolation is enforced by `CompanyAccessService` (from prior phases). RBAC hardening here does not replace tenant checks.

---

## Files changed (Phase 1.4)

- `backend/src/modules/companies/companies.controller.ts`
- `backend/src/modules/users/users.controller.ts`
- `backend/src/modules/warehouses/warehouses.controller.ts`
- `backend/src/modules/locations/locations.controller.ts`
- `backend/src/modules/products/products.controller.ts`
- `backend/src/modules/inventory/inventory.controller.ts`

---

## Verification

```powershell
cd backend
npx tsc --noEmit
```

No TypeScript or linter issues introduced.

