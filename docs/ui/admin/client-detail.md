# Client detail

**App:** Admin Dashboard
**Route(s):** `/clients/:id`
**Source:** `frontend/src/pages/CompanyDetailPage.tsx`
**Nav label:** Clients (detail)

## Purpose

Company profile detail.

## Primary users

sa/mgr.

## User goals

- Review company profile

## Business goal

Tenant record of truth.

## Main workflows

1. Open → back

## Components

- Profile fields

## Forms

- Display/edit as implemented.

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

- ← clients list
- Billing plan detail by clientId

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
