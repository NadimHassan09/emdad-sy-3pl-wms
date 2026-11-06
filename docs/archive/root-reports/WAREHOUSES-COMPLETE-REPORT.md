# WAREHOUSES-COMPLETE — Warehouses Module Integration

**Sprint:** SPRINT-P1B  
**Date:** 2026-06-09  
**Branch:** `staging`  
**Status:** Complete

---

## Summary

Completed warehouse management module integration by wiring the existing `WarehousesPage` into routing and navigation, enforcing RBAC visibility, adding audit logging for CRUD operations, and enhancing the admin UI with filters and deactivate flow.

---

## Changes

### Frontend routing & navigation

| Item | Change |
|------|--------|
| Route | `GET /warehouses` → `WarehousesPage` registered in `router.tsx` |
| Sidebar nav | **Warehouses** entry added to `NAV_CATALOG` (after Locations) |
| RBAC | `routeGroup('warehouses')` + `ROUTE_GROUP_ROLES: ['super_admin', 'wh_manager']` |
| Icon | `fa-warehouse` added to admin sidebar icons |
| i18n | Arabic label **المستودعات** in `Layout.tsx` |

`RequireRouteAccess` in `Layout.tsx` automatically guards `/warehouses` for unauthorized roles (`wh_operator`, `finance`).

### WarehousesPage enhancements

- `AppPageHeader` with page description
- `FilterPanel` with search (code/name/city/country), status filter, and include-inactive API toggle
- **Deactivate** action via `ConfirmModal` + `DELETE /warehouses/:id`
- Mutation actions restricted to `super_admin` / `wh_manager`
- Client-side filter layer on top of server `includeInactive` fetch

### Backend audit logging

`WarehousesService` now writes audit events via `AuditLogService`:

| Action | Audit code |
|--------|------------|
| Create | `WAREHOUSE_CREATED` |
| Update | `WAREHOUSE_UPDATED` |
| Status change | `WAREHOUSE_STATUS_CHANGED` |
| Soft delete | `WAREHOUSE_DEACTIVATED` |

`resourceType: 'warehouse'` — filterable in Audit Logs page.

Controller mutations now accept `@CurrentUser()` principal for actor attribution.

---

## Verification

### Build

| Target | Result |
|--------|--------|
| `backend npm run build` | PASS |
| `frontend npm run build` | PASS |

### API integration (`scripts/warehouses-complete-verify.mjs`)

```
WAREHOUSES-COMPLETE verification: PASS
  GET /warehouses (active only)           — 13ms (8 active)
  GET /warehouses?includeInactive=true    — 8ms  (37 total)
  GET /warehouses/next-code               — 7ms
  POST /warehouses                        — 13ms (create)
  PATCH /warehouses/:id                   — 14ms (update)
  DELETE /warehouses/:id                  — 10ms (deactivate)
  PATCH /warehouses/:id/status            — 9ms  (reactivate)
  GET /audit-logs (warehouse)             — 15ms (4 events: CREATED/UPDATED/DEACTIVATED/STATUS_CHANGED)
  GET /inventory/stock?warehouseId=       — 19ms (warehouse-scoped stock)
  GET /inbound-orders?warehouseId=        — 297ms (warehouse-scoped inbound)
  GET /outbound-orders?warehouseId=       — 186ms (warehouse-scoped outbound)
```

### E2E (Playwright `e2e/warehouses-ui.spec.ts`)

**4/4 PASS**

- Warehouses page list + create button
- Filter panel (search, status, include inactive)
- Sidebar **Warehouses** nav link visible for `super_admin`
- Search filter narrows rows

---

## Integration notes

| Area | Integration |
|------|-------------|
| **Inventory** | Stock queries accept `warehouseId`; default warehouse resolved via `useDefaultWarehouseId()` on inventory pages |
| **Inbound / Outbound** | List and detail pages scope orders by `warehouseId` query param |
| **Locations** | Locations page operates within default warehouse context |
| **Audit logs** | Warehouse CRUD events appear with `resource_type = warehouse` |
| **Realtime** | Existing `warehouse.created` / `warehouse.updated` WS events unchanged |

**Operational model:** Staging runs primarily on WH-001 (single active warehouse). Additional warehouses can be provisioned via the new admin page; operators continue to use env/default warehouse resolution until a global warehouse switcher is added (future P2).

---

## Key files

**Frontend**

- `frontend/src/router.tsx`
- `frontend/src/lib/rbac.ts`
- `frontend/src/components/Layout.tsx`
- `frontend/src/pages/WarehousesPage.tsx`
- `frontend/e2e/warehouses-ui.spec.ts`
- `shared/design-system/lib/sidebar-nav-icons.tsx`

**Backend**

- `backend/src/modules/warehouses/warehouses.controller.ts`
- `backend/src/modules/warehouses/warehouses.service.ts`
- `backend/src/modules/warehouses/warehouses.module.ts`

**Scripts**

- `scripts/warehouses-complete-verify.mjs`
