# OMS returns report

**App:** Admin Dashboard
**Route(s):** `/oms/returns` (feature-flagged)
**Source:** `frontend/src/pages/OmsCodReturnsPages.tsx (`OmsReturnsPage`)`
**Nav label:** OMS Returns

## Purpose

Returns report workspace (OMS analytics).

## Primary users

sa/mgr/finance when flag on.

## User goals

- Analyze return rates/volumes

## Business goal

Ecommerce returns intelligence.

## Main workflows

1. Filter → generate → export

## Components

- `ReportWorkspace`

## Forms

- Report filters.

## Tables

- Preview table.

## Filters

- `returns-report` catalog filters.

## Actions

- Generate
- Export

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

OMS + UI flag.

## Relationships with other pages

- WMS `/returns` operational counterpart

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
