# Billing invoice detail (Admin)

**App:** Admin Dashboard
**Route(s):** `/billing/invoices/:id`
**Source:** `frontend/src/pages/billing/BillingInvoiceDetailPage.tsx`
**Nav label:** Billing → Invoices (detail)

## Purpose

Invoice lines with inline manual-line form and status actions.

## Primary users

sa/mgr/finance; mutate sa/mgr.

## User goals

- Adjust lines
- Update status
- Review calculation

## Business goal

Accurate client invoicing.

## Main workflows

1. Review → add manual line → update status

## Components

- Line tables
- inline form

## Forms

- Manual invoice line form.

## Tables

- Invoice lines.

## Filters

- None.

## Actions

- Add line
- Update status

## Dialogs

- None.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- Not applicable or not explicitly implemented.

## Loading states

- Standard query pending / Suspense `PageLoadFallback` via layout.

## Validation

- Line amount/qty validation.

## Permissions

Mutate sa/mgr.

## Relationships with other pages

- ← invoices list

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
