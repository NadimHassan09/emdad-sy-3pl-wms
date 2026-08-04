# Backup retention

**App:** Admin Dashboard
**Route(s):** `/settings/backups/retention`
**Source:** `frontend/src/pages/settings/BackupRetentionPage.tsx`
**Nav label:** Settings → Retention

## Purpose

Retention policies, preview, cleanup confirms.

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

- Settings forms on this page (Policy forms).

## Tables

- Policy forms.

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

- ConfirmModals.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- Not applicable or not explicitly implemented.

## Loading states

- Standard query pending / Suspense `PageLoadFallback` via layout.

## Validation

- Destructive actions require ConfirmModal / typed confirms where implemented.

## Permissions

mutate for cleanup. Super-admin-only tabs redirect others home.

## Relationships with other pages

- Sibling settings tabs under `/settings/backups/*`
- Affects whole system availability

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
