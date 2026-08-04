# Cycle count detail

**App:** Admin Dashboard
**Route(s):** `/cycle-count/:id`
**Source:** `frontend/src/pages/cycle-count/CycleCountDetailPage.tsx`
**Nav label:** Cycle count (detail)

## Purpose

Session lines, variances, reconcile/complete.

## Primary users

sa/mgr/operator (operators limited).

## User goals

- Review variances
- Reconcile/complete
- Launch execute

## Business goal

Resolve inventory discrepancies.

## Main workflows

1. Review → execute or reconcile

## Components

- Lines/variances tables
- ConfirmModal

## Forms

- None on this page (read-only or list-only).

## Tables

- Lines + variances.

## Filters

- None.

## Actions

- Execute
- Reconcile
- Complete

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

Operators limited; reconcile/complete non-operator.

## Relationships with other pages

- → execute
- ← list

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
