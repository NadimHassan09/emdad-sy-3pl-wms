# Billing dashboard

**App:** Admin Dashboard
**Route(s):** `/billing/dashboard` (`/billing` redirects)
**Source:** `frontend/src/pages/billing/BillingDashboardPage.tsx`
**Nav label:** Billing → Dashboard

## Purpose

Billing KPIs and summaries.

## Primary users

sa/mgr/finance.

## User goals

- Monitor receivables/plans health

## Business goal

3PL revenue operations pulse.

## Main workflows

1. View cards → jump plans/invoices

## Components

- KPI cards

## Forms

- None on this page (read-only or list-only).

## Tables

- None.

## Filters

- None.

## Actions

- Navigate plans/invoices

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

- → plans, invoices

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
