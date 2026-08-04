# Dashboard overview

**App:** Admin Dashboard
**Route(s):** `/dashboard/overview` (`/dashboard` redirects here)
**Source:** `frontend/src/pages/DashboardOverviewPage.tsx`
**Nav label:** Dashboard

## Purpose

Operational warehouse KPIs, billing widgets, open-order stage bars, open tasks chart, storage utilization, and expiry alerts.

## Primary users

Route `dashboard`: `super_admin`, `wh_manager`, `finance` (not operators — operators land on `/tasks`).

## User goals

- Monitor warehouse health at a glance
- Drill into products, clients, orders, tasks, billing, ledger

## Business goal

Give leadership a single ops and billing pulse.

## Main workflows

1. Load overview metrics
2. Click metric cards / section links to related domains
3. Retry on load failure

## Components

- Section `Warehouse overview` — `WarehouseOverviewMetricCard` (`Items in catalog` → `/products`, `Total customers` → `/clients`)
- Section `Billing` — `BillingExpiringClientsCard`, `BillingOverdueClientsCard`, `BillingRecentInvoicesCard`, `BillingSuspendedAccountsCard`
- `OpenOrdersStageBarCard` — `Open inbound orders` → `/orders/inbound`; `Open outbound orders` → `/orders/outbound`
- `OpenTasksByTypeChartCard` — `Open tasks` → `/tasks`
- Storage utilization card (`Remaining` / `Used`) → `/billing/plans`
- Section `Expiry alerts` → `/inventory/ledger`
- Skeleton variants for loading; error Alert with Retry

## Forms

- None (read-only overview).

## Tables

Expiry alerts headers: **Product**, **Lot**, **Expiry**, **Location**, **Qty**.

Also lists recent open inbound/outbound order links when present on the page.

## Filters

- None.

## Actions

- Navigate via card `to` links
- Retry (`Could not load dashboard`)
- Query refresh via react-query

## Dialogs

- None.

## Drawers

- None.

## Empty states

- Expiry: `No lots expiring soon.`
- Skeleton titles while loading include: Open inbound orders, Open outbound orders, Open tasks by type, Warehouse capacity consumption

## Loading states

- Skeleton metric/order/task/capacity cards.

## Validation

- N/A.

## Permissions

- Route group `dashboard`: sa/mgr/finance.
- Nav catalog same roles.

## Relationships with other pages

- `/products`, `/clients`, `/orders/inbound`, `/orders/outbound`, `/tasks`, `/billing/plans`, `/inventory/ledger`
- Direct order links `/orders/inbound/:id`, `/orders/outbound/:id`

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
