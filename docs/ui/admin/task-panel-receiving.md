# Task panel — Receiving

**App:** Admin Dashboard
**Route(s):** Rendered inside `/tasks/:id` when `taskType=receiving`
**Source:** `frontend/src/pages/tasks/receiving/ReceivingExecutionPanel.tsx`
**Nav label:** Tasks execution (panel)

## Purpose

Scan/receive expected inbound lines into inventory with wedge shortcuts.

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

- Per-line receive quantities/lots; scan field.

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

- ProductSpecsValidationModal, BarcodeScanModal.

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
