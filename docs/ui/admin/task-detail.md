# Task execution

**App:** Admin Dashboard
**Route(s):** `/tasks/:id` (`/tasks/:id/execute` redirects here)
**Source:** `frontend/src/pages/TaskDetailPage.tsx` → `TaskExecutionView.tsx` + type panels
**Nav label:** Tasks (execution)

## Purpose

Single task execution centre: assign/start/complete/resolve with type-specific panels (receiving, putaway, pick, pack, dispatch, QC).

## Primary users

Route `tasks`: `super_admin`, `wh_manager`, `wh_operator`. `isWorkerAccount = isOperatorRole` hides assign-others, operator-notes editor for non-workers differently, and PDF export (`showExportPdf={!isWorkerAccount}`).

## User goals

- Assign / start / execute scan-driven work
- Complete task and continue to next
- Managers resolve blocked / retry_pending states

## Business goal

Standardize warehouse floor execution and inventory effects.

## Main workflows

1. Assign/start → type panel scan/execute → complete → CompletedTaskNextSteps / next task
2. Manager: Resume after retry (`retry_pending`)
3. Manager: Apply resolution on `blocked` (resume / cancel_remaining / approve_partial / fork_new_task)

## Components

- Task header with inbound/outbound order links
- Assign bar (Assigned worker, Start, Assign someone else / Assign worker / Assign / Hide assign)
- Operator notes panel (when in_progress and viewer not the worker path)
- Type panels under `pages/tasks/*`
- `WedgeScanField` (panels)
- `CompletedTaskNextSteps`, `OrderNextTaskHandoff`
- QC lines table when applicable

## Forms

- Panel-specific: qty, destination, packages, skip reasons, JSON complete fallback
- Retry: Reason (optional) → Resume after retry
- Blocked resolve: Resolution options + Resolution note → Apply resolution
- Operator notes: Save notes

## Tables

QC sub-table (when present): headers **Line**, **Eligible**, **Result** / Passed, Failed; section title `QC lines`; empty `No QC lines.`

## Filters

- None on execution page.

## Actions

- Start / Assign / Assign someone else
- Save notes
- Resume after retry / Apply resolution
- Complete / continue next task (panel-driven)
- Export PDF (non-operator)

## Dialogs

- No page-level ConfirmModal; panels may open type-specific modals (e.g. pack PackageDetailsModal, dispatch AddToShipment).

## Drawers

- None.

## Empty states

- Load: `Could not load task.` / `Loading task…`
- QC: `No QC lines.`

## Loading states

- `Loading task…`

## Validation

- Panel-level qty/scan validation; resolution requires selected option.

## Permissions

- Route: tasks (sa/mgr/operator).
- Operators: restricted assign UI and no export PDF; list already self-scoped.
- Manager resolve panels for blocked / retry_pending.

## Relationships with other pages

- Inbound order → `/orders/inbound/:id`
- Outbound order → `/orders/outbound/:id`
- ← `/tasks`
- Next task handoff within workflow

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
