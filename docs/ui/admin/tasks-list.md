# Tasks list

**App:** Admin Dashboard
**Route(s):** `/tasks` (+ `?taskType=` via sub-nav)
**Source:** `frontend/src/pages/TasksListPage.tsx`
**Nav label:** Tasks (+ Receiving / QC / Putaway / Quarantine / Pick / Pack / Dispatch tabs)

## Purpose

Warehouse task queue with type/status filters, order search, and row open into execution.

## Primary users

Route `tasks`: `super_admin`, `wh_manager`, `wh_operator`. Operators (`isOperatorRole`) are auto-scoped to their own `workerId`.

## User goals

- Find next work by type/status/search
- Open execution view
- Use typed sub-nav to pre-set `taskType`

## Business goal

Floor throughput via prioritized task execution.

## Main workflows

1. Filter / search → open `/tasks/:id` (optional `?companyId=`)
2. Sub-nav sets `taskType` query
3. Clear filters when empty result from filters

## Components

- `FilterPanel` (`Task filters`)
- `DataTable` title `Warehouse tasks`
- Filter chips
- Status badges / friendly type labels

## Forms

- Filters only (no create form).

## Tables

Columns: **Task type**, **Order #**, **Status**, **Assigned worker**, **Started at**, **Ended at**, **Duration**.

## Filters

FilterPanel: **Task filters**

| Field | Options / notes |
| --- | --- |
| Task type | All task types; Receiving; Quality check; Putaway; Putaway (quarantine); Pick; Pack; Dispatch; Routing |
| Status | All statuses; Pending; Assigned; In progress; Completed; Blocked; Failed; Retry pending; Cancelled |
| Search | placeholder `Order number or task / order id` |

Apply / Reset. Chips for Type, Status, Search.

## Actions

- Open task row
- Reset / clear filters
- Retry on `Failed to load tasks`

## Dialogs

- None.

## Drawers

- None.

## Empty states

- Filtered: `No tasks match these filters.` (+ Clear filters)
- First-run: `No warehouse tasks yet.`
- Error: `Failed to load tasks` (+ Retry)

## Loading states

- DataTable skeleton rows.

## Validation

- N/A (no primary mutation form).

## Permissions

- Route: tasks (sa/mgr/operator).
- `isOperatorRole` → list request includes current user as worker (others’ work hidden by default).

## Relationships with other pages

- → `/tasks/:id`
- Sub-nav Internal transfer → `/internal` (sa/mgr only)

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
