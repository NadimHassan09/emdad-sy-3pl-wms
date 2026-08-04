# Inventory product detail

**App:** Admin Dashboard
**Route(s):** `/inventory/product/:productId`
**Source:** `frontend/src/pages/InventoryProductDetailPage.tsx`
**Nav label:** Inventory → Stock (detail)

## Purpose

Per-product stock by location/lot.

## Primary users

sa/mgr/finance.

## User goals

- See where stock sits
- Inspect lots

## Business goal

Location-level inventory accuracy.

## Main workflows

1. Open from stock list → review → back

## Components

- Header
- location/lot table

## Forms

- None on this page (read-only or list-only).

## Tables

- Location/lot breakdown.

## Filters

- None.

## Actions

- Back

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

Inventory group.

## Relationships with other pages

- ← `/inventory/stock`

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
