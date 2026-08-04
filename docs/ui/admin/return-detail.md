# Return detail (WMS)

**App:** Admin Dashboard
**Route(s):** `/returns/:id`
**Source:** `frontend/src/pages/returns/ReturnDetailPage.tsx`
**Nav label:** Returns (detail)

## Purpose

Return header/lines; start/cancel; navigate to process.

## Primary users

sa/mgr/operator (operators can’t start/cancel).

## User goals

- Inspect return
- Start processing

## Business goal

Gate floor processing of returns.

## Main workflows

1. Review → process

## Components

- Lines table
- ConfirmModal

## Forms

- None on this page (read-only or list-only).

## Tables

- Return lines.

## Filters

- None.

## Actions

- Start
- Cancel
- Process

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

Operators restricted on start/cancel.

## Relationships with other pages

- → `/returns/:id/process`
- ← list

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
