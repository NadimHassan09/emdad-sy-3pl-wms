# Billing plan detail

**App:** Admin Dashboard
**Route(s):** `/billing/plans/:clientId`
**Source:** `frontend/src/pages/billing/BillingPlanDetailPage.tsx`
**Nav label:** Billing → Plans (detail)

## Purpose

View plan rates/status for a client.

## Primary users

sa/mgr/finance.

## User goals

- Review rates
- Edit plan

## Business goal

Transparent commercial configuration.

## Main workflows

1. View → edit

## Components

- Rates/display sections

## Forms

- None on this page (read-only or list-only).

## Tables

- None.

## Filters

- None.

## Actions

- Edit

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

Billing group.

## Relationships with other pages

- → edit
- ← list

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
