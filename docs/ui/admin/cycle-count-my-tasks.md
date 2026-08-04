# Cycle count my tasks

**App:** Admin Dashboard
**Route(s):** `/cycle-count/my-tasks`
**Source:** `frontend/src/pages/cycle-count/CycleCountMyTasksPage.tsx`
**Nav label:** Cycle count → My tasks

## Purpose

Worker’s blind count assignments (requires workerId).

## Primary users

Operators with worker profile.

## User goals

- See my counts
- Start execute

## Business goal

Distribute count work to floor workers.

## Main workflows

1. List → execute

## Components

- Table or no-worker gate

## Forms

- None on this page (read-only or list-only).

## Tables

- My count tasks.

## Filters

- None.

## Actions

- Open execute

## Dialogs

- None.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- Gate when no workerId.

## Loading states

- Standard query pending / Suspense `PageLoadFallback` via layout.

## Validation

- N/A (no primary form).

## Permissions

Needs `canExecuteCycleCount` (workerId).

## Relationships with other pages

- → `/cycle-count/:id/execute`

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
