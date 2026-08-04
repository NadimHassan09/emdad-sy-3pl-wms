# Inventory ledger entry

**App:** Admin Dashboard
**Route(s):** `/inventory/ledger/line/:ledgerId/:createdAt`
**Source:** `frontend/src/pages/InventoryLedgerEntryPage.tsx`
**Nav label:** Inventory → Ledger (entry)

## Purpose

Single ledger line with related documents.

## Primary users

sa/mgr/finance.

## User goals

- Understand one movement
- Open related docs

## Business goal

Deep audit trail.

## Main workflows

1. Open → follow links

## Components

- Detail
- linked tables

## Forms

- None on this page (read-only or list-only).

## Tables

- Related documents.

## Filters

- None.

## Actions

- Open inbound/outbound/adjustment

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

- ← ledger
- → orders/adjustments

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
