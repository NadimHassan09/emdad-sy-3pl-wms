# OMS dashboard

**App:** Admin Dashboard
**Route(s):** `/oms/dashboard` (`/oms` redirects)
**Source:** `frontend/src/pages/OmsDashboardPage.tsx`
**Nav label:** OMS Dashboard

## Purpose

OMS KPI cards for merchant order operations.

## Primary users

sa/mgr/finance.

## User goals

- Pulse ecommerce ops

## Business goal

Separate ecommerce ops metrics from WMS floor.

## Main workflows

1. View KPIs → navigate OMS orders

## Components

- Header
- dashboard cards

## Forms

- None on this page (read-only or list-only).

## Tables

- None.

## Filters

- None.

## Actions

- Navigate OMS domains

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

OMS group.

## Relationships with other pages

- → OMS orders / COD / returns

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
