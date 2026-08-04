# Warehouse users

**App:** Admin Dashboard
**Route(s):** `/users/warehouse_users` (`/users` redirects)
**Source:** `frontend/src/pages/UsersPage.tsx (`WarehouseUsersPage`)`
**Nav label:** Users → Warehouse users

## Purpose

System/warehouse user administration.

## Primary users

sa/mgr.

## User goals

- Create/edit users
- Open detail

## Business goal

Control WMS access.

## Main workflows

1. Filter → create/edit modal → detail

## Components

- FilterPanel
- DataTable

## Forms

- Create/Edit user modals.

## Tables

- Users table.

## Filters

- Role/search filters.

## Actions

- Create
- Edit
- Open detail

## Dialogs

- Create/Edit modals.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- Not applicable or not explicitly implemented.

## Loading states

- Standard query pending / Suspense `PageLoadFallback` via layout.

## Validation

- N/A (no primary form).

## Permissions

Users group sa/mgr.

## Relationships with other pages

- → `/users/warehouse_users/:id`

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
