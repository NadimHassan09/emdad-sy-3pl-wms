# Task panel — Dispatch

**App:** Admin Dashboard
**Route(s):** Inside `/tasks/:id` when `taskType=dispatch`
**Source:** `frontend/src/pages/tasks/dispatch/DispatchExecutionPanel.tsx`
**Nav label:** Tasks execution (panel)

## Purpose

Add packages to shipments and dispatch (naming: Dispatch).

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

- Shipment assignment forms.

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

- DispatchAddToShipmentModal, scan.

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
