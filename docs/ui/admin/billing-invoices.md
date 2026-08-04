# Billing invoices

**App:** Admin Dashboard
**Route(s):** `/billing/invoices`
**Source:** `frontend/src/pages/billing/BillingInvoicesPage.tsx`
**Nav label:** Billing → Invoices

## Purpose

Admin list of subscription / cycle invoices with status filters and mutate actions for managers.

## Primary users

Route `billing`: `super_admin`, `wh_manager`, `finance`. `canMutate` for sa/mgr only.

## User goals

- Find invoices by number, client, status, dates
- Open invoice detail
- Mark as paid / edit / delete when allowed

## Business goal

Operate 3PL receivables for storage subscriptions.

## Main workflows

1. Filter → row click / View → `/billing/invoices/:id`
2. Mark as paid / Edit / Delete (canMutate, status-gated)

## Components

- `PageHeader` — `Subscription invoices`; subtitle `Cycle invoices for client storage subscriptions.`
- `FilterPanel` (`Invoice filters`)
- `DataTable` title `Invoices` (description `Click a row to view invoice details.`)

## Forms

- None on list page; Delete uses `window.confirm(`Delete invoice ${invoiceNumber}?`)`.

## Tables

Columns: **Invoice number**, **Client**, **Billing period**, **Amount**, **Issue date**, **Due date**, **Status**, **Actions**.

Row actions: View; Edit (canMutate); Mark as paid (canMutate + eligible status); Delete (canMutate when `draft` \| `cancelled`).

## Filters

FilterPanel: **Invoice filters**

| Field | Options / notes |
| --- | --- |
| Invoice # | placeholder `Search invoice...` |
| Client | All clients |
| Status | All statuses; Draft; Issued (`unpaid`); Overdue; Paid; Cancelled |
| Created from / Created to | dates |
| Sort by | Created; Issue date; Invoice number; Amount; Status |
| Sort direction | Descending; Ascending |

## Actions

- View / open row
- Edit, Mark as paid, Delete (gated)
- Apply / Reset filters

## Dialogs

- Browser confirm for Delete only (no ConfirmModal component).

## Drawers

- None.

## Empty states

- `No subscription invoices match your filters.`

## Loading states

- DataTable initial loading / filter fetching.

## Validation

- N/A on list.

## Permissions

- Route: sa/mgr/finance.
- `canMutate` (sa/mgr) for Edit / Mark as paid / Delete.

## Relationships with other pages

- → `/billing/invoices/:id`
- Sub-nav peers: Plans, Billing dashboard

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
