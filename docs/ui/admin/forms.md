# Forms (lead submissions)

**App:** Admin Dashboard
**Route(s):** `/forms`
**Source:** `frontend/src/pages/forms/FormsPage.tsx`
**Nav label:** Forms

## Purpose

Lead/form submissions inbox.

## Primary users

sa/mgr; delete sa only.

## User goals

- Review submissions
- Delete spam

## Business goal

Inbound sales/lead capture ops.

## Main workflows

1. Filter → detail modal → delete

## Components

- FilterPanel
- DataTable
- detail Modal

## Forms

- None (read submissions).

## Tables

- Submissions.

## Filters

- Status/date filters.

## Actions

- Open detail
- Delete

## Dialogs

- Detail Modal, Confirm delete.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- Not applicable or not explicitly implemented.

## Loading states

- Standard query pending / Suspense `PageLoadFallback` via layout.

## Validation

- N/A (no primary form).

## Permissions

sa/mgr; delete super_admin only.

## Relationships with other pages

- Standalone acquisitions funnel

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
