# Client users

**App:** Admin Dashboard
**Route(s):** `/users/client_users`
**Source:** `frontend/src/pages/UsersPage.tsx (`ClientUsersPage`)`
**Nav label:** Users → Client users

## Purpose

Client portal user administration.

## Primary users

sa/mgr.

## User goals

- Create/edit client users
- Open detail

## Business goal

Merchant portal access control.

## Main workflows

1. Filter → create/edit → detail

## Components

- FilterPanel
- DataTable

## Forms

- Create/Edit modals.

## Tables

- Client users.

## Filters

- Company/role/search.

## Actions

- Create
- Edit
- Open

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

sa/mgr.

## Relationships with other pages

- → `/users/client_users/:id`
- Client Portal login

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
