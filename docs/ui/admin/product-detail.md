# Product detail (Admin)

**App:** Admin Dashboard
**Route(s):** `/products/:sku`
**Source:** `frontend/src/pages/ProductDetailPage.tsx`
**Nav label:** Products (detail)

## Purpose

Admin product attribute/UoM display.

## Primary users

sa/mgr.

## User goals

- Inspect product master

## Business goal

Authoritative SKU definition.

## Main workflows

1. Open → back

## Components

- Attribute/UoM display

## Forms

- None (read/display; edit via list modals).

## Tables

- None.

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

sa/mgr.

## Relationships with other pages

- ← `/products`

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
