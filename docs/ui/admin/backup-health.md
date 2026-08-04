# Backup health

**App:** Admin Dashboard
**Route(s):** `/settings/backups/health`
**Source:** `frontend/src/pages/settings/BackupHealthPage.tsx`
**Nav label:** Settings → Health

## Purpose

Health status panels and events.

## Primary users

Backup admins (sa/mgr read; many writes sa-only).

## User goals

- Protect/recover system data
- Operate backup policies

## Business goal

Disaster recovery and data governance.

## Main workflows

1. Configure/run backup operations with confirmations
2. Maintenance overlay during restore/reset for sa

## Components

- SettingsLayout
- SettingsNav
- page-specific panels
- SystemMaintenanceScreen (global)

## Forms

- Settings forms on this page (Status panels).

## Tables

- Status panels.

## Filters

- History filters where applicable.

## Actions

- Save
- Run
- Upload
- Restore
- Delete
- Connect — as page allows

## Dialogs

- None primary.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- Not applicable or not explicitly implemented.

## Loading states

- Standard query pending / Suspense `PageLoadFallback` via layout.

## Validation

- Destructive actions require ConfirmModal / typed confirms where implemented.

## Permissions

read sa/mgr. Super-admin-only tabs redirect others home.

## Relationships with other pages

- Sibling settings tabs under `/settings/backups/*`
- Affects whole system availability

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
