# Billing plan templates

**App:** Admin Dashboard
**Route(s):** `/billing/templates`
**Source:** `frontend/src/pages/billing/BillingPlanTemplatesPage.tsx`
**Nav label:** Billing (templates; linked from plans)

## Purpose

Rate templates CRUD.

## Primary users

sa/mgr.

## User goals

- Reuse rate templates

## Business goal

Speed plan creation consistency.

## Main workflows

1. Create/edit template modal

## Components

- Table
- Modal

## Forms

- Template create/edit.

## Tables

- Templates.

## Filters

- None.

## Actions

- Create
- Edit

## Dialogs

- Create/edit template Modal.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- Not applicable or not explicitly implemented.

## Loading states

- Standard query pending / Suspense `PageLoadFallback` via layout.

## Validation

- N/A (no primary form).

## Permissions

Mutate sa/mgr.

## Relationships with other pages

- ← plans

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
