# Inventory ledger by reference

**App:** Admin Dashboard
**Route(s):** `/inventory/ledger/:referenceType/:referenceId`
**Source:** `frontend/src/pages/InventoryLedgerReferencePage.tsx`
**Nav label:** Inventory → Ledger (by reference)

## Purpose

All ledger lines for a reference document.

## Primary users

sa/mgr/finance.

## User goals

- See all movements for a doc

## Business goal

Document-centric audit.

## Main workflows

1. Open from links → review table

## Components

- Table

## Forms

- None on this page (read-only or list-only).

## Tables

- Ledger lines for reference.

## Filters

- None.

## Actions

- Navigate related

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

- ← ledger / documents

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
