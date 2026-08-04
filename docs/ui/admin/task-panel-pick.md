# Task panel — Pick

**App:** Admin Dashboard
**Route(s):** Inside `/tasks/:id` when `taskType=pick`
**Source:** `frontend/src/pages/tasks/pick/PickExecutionPanel.tsx`
**Nav label:** Tasks execution (panel)

## Purpose

Pick reserved lines with scan shortcuts and reservation awareness.

## Primary users

Operators and managers executing tasks.

## User goals

- Complete typed warehouse step with minimal chrome

## Business goal

Specialize floor UX per workflow stage.

## Main workflows

1. Enter from task detail → scan/act → complete parent task

## Components

- Panel chrome
- WedgeScanField where applicable
- line tables

## Forms

- Line pick confirmations / filters.

## Tables

- Task line tables.

## Filters

- Line filters where implemented.

## Actions

- Scan
- Confirm line
- Open dialogs
- Complete via parent

## Dialogs

- Scan helpers.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- Not applicable or not explicitly implemented.

## Loading states

- Standard query pending / Suspense `PageLoadFallback` via layout.

## Validation

- N/A (no primary form).

## Permissions

Inherited from task detail / task type.

## Relationships with other pages

- Parent `/tasks/:id`
- Related inbound/outbound documents

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
