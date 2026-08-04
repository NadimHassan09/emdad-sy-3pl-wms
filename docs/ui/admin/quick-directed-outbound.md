# Quick directed outbound

**App:** Admin Dashboard
**Route(s):** `/orders/directed-outbound` (alias `/directed-outbound`)
**Source:** `frontend/src/pages/QuickDirectedOutboundPage.tsx`
**Nav label:** Outbound → Quick outbound

## Purpose

Fast path to create directed outbound shipments.

## Primary users

Orders roles.

## User goals

- Create directed outbound quickly
- See success result

## Business goal

Reduce friction for known directed picks.

## Main workflows

1. Filter/select → create modal → success → open outbound

## Components

- Filters
- table
- modals

## Forms

- `CreateQuickDirectedOutboundModal`.

## Tables

- Supporting selection table.

## Filters

- None.

## Actions

- Create
- Open result

## Dialogs

- Create modal, success Modal.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- Not applicable or not explicitly implemented.

## Loading states

- Standard query pending / Suspense `PageLoadFallback` via layout.

## Validation

- N/A (no primary form).

## Permissions

Orders group.

## Relationships with other pages

- → outbound detail

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
