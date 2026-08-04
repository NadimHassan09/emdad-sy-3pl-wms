# Report — Delivery Report

**App:** Admin Dashboard
**Route(s):** `/reports/delivery-report`
**Source:** `frontend/src/pages/reports/* + ReportWorkspace`
**Nav label:** Reports → Delivery Report

## Purpose

Carrier/milestones via shared ReportWorkspace.

## Primary users

sa/mgr/finance.

## User goals

- Configure filters
- Generate preview
- Export

## Business goal

Operational/financial decision support.

## Main workflows

1. Set filters → generate → chart/pivot/table → export

## Components

- `ReportsLayout`
- `ReportWorkspace`
- KPI grid
- preview table
- chart/pivot

## Forms

- Report filter panel fields from catalog.

## Tables

- Preview results table.

## Filters

- Catalog-defined filters per report.

## Actions

- Generate
- Export
- Switch report tab

## Dialogs

- None.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- Empty preview when no data.

## Loading states

- Generate loading state.

## Validation

- Filter required constraints per report.

## Permissions

Reports group sa/mgr/finance.

## Relationships with other pages

- Sibling reports under `/reports/*`
- COD/returns report routes redirect to `/oms/cod` or `/oms/returns`

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
