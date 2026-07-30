# Emdad Design System (`@ds` / `@emdad/ds`)

**Source of truth:** `shared/design-system/ui` (Vite alias `@ds`).

## Ownership

| Layer | Owns |
|-------|------|
| `@ds` | Primitives, AppShell, list recipe (`ListPageHeader`, `TableFooterPagination`, `StatusBadge`, `Card`, `Button`, form fields, pagination hook) |
| Admin `frontend/src/components/*` | Thin re-export wrappers where call sites still use local paths (`Button`, `PageHeader`, `TextField`, `Combobox`, …) |
| Client `design-v2/*` | Temporary re-exports → prefer importing from `@ds` directly; `StorePillTabs` / `PillTabs` stay Client-only |

## List recipe (pilots)

1. One `ListPageHeader` / `AppPageHeader` (title + optional subtitle + one primary CTA)
2. Filter strip (not a nested card-in-card)
3. Single table surface + `TableFooterPagination` (1-based) or `Pagination` (0-based)
4. First-run empty vs filtered-empty copy

Pilots: Admin Inbound list, Client Online orders.

## Package

Optional stub: `@emdad/ds` via `shared/design-system/package.json`. Apps continue to resolve `@ds` through Vite aliases — no publish step required.

## Pagination hook

`useChunkedServerPagination` lives in `shared/design-system/hooks/` (SoT).  
- Client: `client-frontend/src/hooks/useChunkedServerPagination.ts` re-exports it (avoids `@wms` and keeps react-query out of the `@ds` barrel).  
- Admin: `frontend/src/hooks/useChunkedServerPagination.ts` holds the same implementation for local import stability.
