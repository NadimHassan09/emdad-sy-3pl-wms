# OMS COD report

**App:** Admin Dashboard
**Route(s):** `/oms/cod` (feature-flagged; report aliases redirect)
**Source:** `frontend/src/pages/OmsCodReturnsPages.tsx (`OmsCodPage`)`
**Nav label:** COD

## Purpose

COD report workspace via ReportWorkspace.

## Primary users

sa/mgr/finance when `OMS_COD_RETURNS_UI_ENABLED`.

## User goals

- Analyze COD collections

## Business goal

Finance visibility into COD.

## Main workflows

1. Set filters → generate → export

## Components

- `ReportWorkspace`

## Forms

- Report filters.

## Tables

- Preview table.

## Filters

- Catalog filters for `cod-report`.

## Actions

- Generate
- Export

## Dialogs

- None.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- Report empty state.

## Loading states

- Report loading.

## Validation

- N/A (no primary form).

## Permissions

OMS + UI flag else redirect dashboard.

## Relationships with other pages

- Report catalog; Client `/my-profits` counterpart

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
