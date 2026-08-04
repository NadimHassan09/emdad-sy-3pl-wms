# Adjustment detail

**App:** Admin Dashboard
**Route(s):** `/inventory/adjustments/:id`
**Source:** `frontend/src/pages/AdjustmentDetailPage.tsx`
**Nav label:** Inventory → Adjustments (detail)

## Purpose

Adjustment lines and post confirmation.

## Primary users

sa/mgr/finance.

## User goals

- Review lines
- Post adjustment

## Business goal

Apply inventory deltas with audit.

## Main workflows

1. Review → Confirm post

## Components

- Lines table
- ConfirmModal

## Forms

- Line editing as allowed.

## Tables

- Adjustment lines.

## Filters

- None.

## Actions

- Post
- Back

## Dialogs

- ConfirmModal.

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

- ← list
- ledger references

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
