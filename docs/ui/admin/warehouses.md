# Warehouses

**App:** Admin Dashboard
**Route(s):** `/warehouses`
**Source:** `frontend/src/pages/WarehousesPage.tsx`
**Nav label:** Warehouses

## Purpose

Warehouse entity CRUD.

## Primary users

sa/mgr.

## User goals

- Manage warehouses

## Business goal

Multi-warehouse tenancy structure.

## Main workflows

1. Filter → create/edit/delete

## Components

- FilterPanel
- DataTable

## Forms

- Create/Edit warehouse.

## Tables

- Warehouses.

## Filters

- Search/status.

## Actions

- Create
- Edit
- Delete

## Dialogs

- Create/Edit, Confirm delete.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- Not applicable or not explicitly implemented.

## Loading states

- Standard query pending / Suspense `PageLoadFallback` via layout.

## Validation

- N/A (no primary form).

## Permissions

sa/mgr; mutate sa/mgr.

## Relationships with other pages

- Locations belong to warehouses
- Active warehouse context

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
