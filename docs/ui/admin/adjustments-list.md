# Stock adjustments

**App:** Admin Dashboard
**Route(s):** `/inventory/adjustments` (alias `/adjustments`)
**Source:** `frontend/src/pages/AdjustmentsPage.tsx`
**Nav label:** Inventory → Adjustments

## Purpose

List and create inventory adjustments.

## Primary users

sa/mgr/finance.

## User goals

- Create adjustment
- Open detail to post

## Business goal

Controlled inventory corrections.

## Main workflows

1. Create → detail → post

## Components

- FilterPanel
- DataTable

## Forms

- NewAdjustmentModal.

## Tables

- Adjustments list.

## Filters

- Status/company filters.

## Actions

- Create
- Open

## Dialogs

- NewAdjustmentModal.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- Not applicable or not explicitly implemented.

## Loading states

- Standard query pending / Suspense `PageLoadFallback` via layout.

## Validation

- N/A (no primary form).

## Permissions

Inventory group.

## Relationships with other pages

- → `/inventory/adjustments/:id`

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
