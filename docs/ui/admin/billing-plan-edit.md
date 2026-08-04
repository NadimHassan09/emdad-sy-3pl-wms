# Billing plan edit

**App:** Admin Dashboard
**Route(s):** `/billing/plans/:clientId/edit`
**Source:** `frontend/src/pages/billing/BillingPlanEditPage.tsx`
**Nav label:** Billing → Plans (edit)

## Purpose

Edit plan with apply confirmation.

## Primary users

sa/mgr.

## User goals

- Change rates
- Apply changes

## Business goal

Controlled commercial updates.

## Main workflows

1. Edit → apply modal → save

## Components

- Form
- apply modal

## Forms

- Plan edit form.

## Tables

- None.

## Filters

- None.

## Actions

- Save
- Apply

## Dialogs

- Apply modal.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- Not applicable or not explicitly implemented.

## Loading states

- Standard query pending / Suspense `PageLoadFallback` via layout.

## Validation

- Form + apply confirmation.

## Permissions

Mutate sa/mgr.

## Relationships with other pages

- ← detail

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
