# Billing plan create

**App:** Admin Dashboard
**Route(s):** `/billing/plans/new`
**Source:** `frontend/src/pages/billing/BillingPlanCreatePage.tsx`
**Nav label:** Billing → Plans (create)

## Purpose

Multi-section form to create a client billing plan.

## Primary users

sa/mgr (mutate).

## User goals

- Configure rates/limits
- Save plan

## Business goal

Attach commercial terms to clients.

## Main workflows

1. Fill sections → submit → detail

## Components

- Multi-section form

## Forms

- Full plan create form.

## Tables

- None.

## Filters

- None.

## Actions

- Submit
- Cancel

## Dialogs

- None.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- Not applicable or not explicitly implemented.

## Loading states

- Standard query pending / Suspense `PageLoadFallback` via layout.

## Validation

- Required commercial fields / DTO validation.

## Permissions

Mutate sa/mgr or deny.

## Relationships with other pages

- → plan detail
- ← plans list

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
