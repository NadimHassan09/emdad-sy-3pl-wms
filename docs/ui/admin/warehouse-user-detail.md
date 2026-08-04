# Warehouse user detail

**App:** Admin Dashboard
**Route(s):** `/users/warehouse_users/:id`
**Source:** `frontend/src/pages/UserDetailPage.tsx`
**Nav label:** Users (warehouse detail)

## Purpose

User profile; worker link for operators.

## Primary users

sa/mgr.

## User goals

- Inspect user
- See worker linkage

## Business goal

Identity and floor worker mapping.

## Main workflows

1. Open → back

## Components

- Profile sections

## Forms

- None on this page (read-only or list-only).

## Tables

- None.

## Filters

- None.

## Actions

- Back

## Dialogs

- None.

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

- ← warehouse users list

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
