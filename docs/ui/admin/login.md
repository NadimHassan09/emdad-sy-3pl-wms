# Login

**App:** Admin Dashboard
**Route(s):** `/login`
**Source:** `frontend/src/pages/LoginPage.tsx`
**Nav label:** — (public)

## Purpose

Authenticate warehouse/admin users into the WMS Admin Dashboard.

## Primary users

`super_admin`, `wh_manager`, `wh_operator`, `finance`.

## User goals

- Sign in
- Land on role home

## Business goal

Secure multi-role warehouse operations access.

## Main workflows

1. Submit credentials → role home (`/tasks` for operators, `/dashboard/overview` otherwise) or `state.from`

## Components

- `LoginScreen` (@ds)

## Forms

- Email/password login form.

## Tables

- None.

## Filters

- None.

## Actions

- Submit login

## Dialogs

- None.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- Not applicable or not explicitly implemented.

## Loading states

- Boot loading + submit loading.

## Validation

- Required fields + auth errors.

## Permissions

Public; redirects if already authenticated.

## Relationships with other pages

- → Role home via `RoleHomeRedirect` / `canAccessPath`

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
