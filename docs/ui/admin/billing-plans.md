# Billing plans

**App:** Admin Dashboard
**Route(s):** `/billing/plans`
**Source:** `frontend/src/pages/billing/BillingPlansPage.tsx`
**Nav label:** Billing → Plans

## Purpose

Per-client billing plan overview with cycle health filters, system storage panel, and create/edit/suspend actions.

## Primary users

Route `billing`: `super_admin`, `wh_manager`, `finance`. Mutations gated by `canMutate = (role === 'super_admin' || role === 'wh_manager')`.

## User goals

- Find plans by client / cycle / billing status
- Open plan detail or edit
- Create plan / open templates
- Suspend or resume subscriptions

## Business goal

Commercial rate and storage subscription configuration.

## Main workflows

1. Filter Active plans table → View → `/billing/plans/:companyId`
2. Create plan → `/billing/plans/new`; Create plan template → `/billing/templates`
3. Edit → `/billing/plans/:companyId/edit`
4. Suspend / Resume with `window.confirm`

## Components

- `PageHeader` title `Billing plans`
- `VolumeAllocationPanel` titled `System storage`
- `FilterPanel` (`Billing plan filters`)
- `DataTable` title `Active plans`
- Action menus

## Forms

- None on this list page (create/edit are separate routes). Confirm strings via `window.confirm` for Suspend/Resume.

## Tables

Columns: **Client**, **Plan type**, **Reserved volume**, **Price**, **Billing cycle**, **Current cycle start**, **Current cycle end**, **Next renewal**, **Status**, **Actions**.

Row actions: View; Edit / Suspend / Resume when `canMutate`.

## Filters

FilterPanel: **Billing plan filters**

| Field | Options |
| --- | --- |
| Search client | text |
| Client | All clients |
| Plan type | All types; Custom; Template |
| Cycle status | All statuses; Active; Renewed; Expired; No cycle |
| Days remaining | All; ≤ 7 days; 8–30 days; > 30 days; Expired; No cycle |
| Billing status | All statuses; Operational; Restricted; Inactive |
| Expiry from / Expiry to | dates |
| Sort by | Created; Client name; Cycle end; Days remaining |
| Sort direction | Descending; Ascending |

Apply filters / Reset filters.

## Actions

- Create plan template / `+ Create plan` (canMutate)
- View / Edit / Suspend / Resume
- Open System storage panel context

## Dialogs

- Browser confirms for Suspend (`Suspend billing plan for {company}?…`) and Resume (`Resume billing plan for {company}?…`)
- No in-app Modal on list page

## Drawers

- None.

## Empty states

- `No billing plans match your filters.`

## Loading states

- DataTable / filter loading flags.

## Validation

- N/A on list (mutations confirm via browser dialog).

## Permissions

- Route: sa/mgr/finance.
- `canMutate` (sa/mgr): Create plan template, + Create plan, Edit, Suspend, Resume.
- Finance: view/filter/open detail only.

## Relationships with other pages

- → `/billing/plans/:companyId`, `/edit`, `/billing/plans/new`, `/billing/templates`
- Sub-nav: Dashboard, Invoices

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
