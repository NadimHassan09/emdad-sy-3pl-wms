# Cycle count execute

**App:** Admin Dashboard
**Route(s):** `/cycle-count/:id/execute`
**Source:** `frontend/src/pages/cycle-count/CycleCountExecutePage.tsx`
**Nav label:** Cycle count (execute)

## Purpose

Blind count scanning UI.

## Primary users

Workers with workerId.

## User goals

- Scan/count locations/SKUs
- Submit counts

## Business goal

Capture physical counts without bias.

## Main workflows

1. Scan → confirm → submit

## Components

- Scan UI
- ConfirmModal

## Forms

- Count entry forms.

## Tables

- None.

## Filters

- None.

## Actions

- Scan
- Submit
- Confirm

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

workerId required.

## Relationships with other pages

- ← detail / my-tasks

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
