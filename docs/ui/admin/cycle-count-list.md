# Cycle count dashboard

**App:** Admin Dashboard
**Route(s):** `/cycle-count`
**Source:** `frontend/src/pages/cycle-count/CycleCountListPage.tsx`
**Nav label:** Cycle count → Dashboard

## Purpose

Sessions and schedule/history for cycle counts.

## Primary users

sa/mgr/operator.

## User goals

- Start/review sessions
- See history

## Business goal

Maintain inventory accuracy via counts.

## Main workflows

1. Filter sessions → open detail

## Components

- Filters
- two DataTables

## Forms

- None on this page (read-only or list-only).

## Tables

- Sessions + history.

## Filters

- Status/date/worker filters.

## Actions

- Open session
- Create/schedule as implemented

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

Cycle-count group.

## Relationships with other pages

- → `/cycle-count/:id`
- → my-tasks

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
