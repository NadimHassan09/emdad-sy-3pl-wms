# Audit logs

**App:** Admin Dashboard
**Route(s):** `/audit-logs`
**Source:** `frontend/src/pages/AuditLogsPage.tsx`
**Nav label:** Audit logs

## Purpose

Security/ops audit trail with rich filters, detail modal, and CSV export.

## Primary users

Route `audit-logs`: `super_admin`, `wh_manager`, `finance`.

## User goals

- Investigate actions by actor/role/company/resource/date
- View before/after detail
- Export CSV evidence

## Business goal

Compliance and forensics.

## Main workflows

1. Apply Audit log filters → open row / View → AuditLogDetailModal
2. Export CSV (respects environment / policy caps)

## Components

- Retention/policy hint text
- `FilterPanel` (`Audit log filters`)
- `DataTable` title `Audit logs`
- `AuditLogDetailModal`
- Export CSV button

## Forms

- Filters only.

## Tables

Columns: **Timestamp**, **Actor**, **Role**, **Company**, **Action**, **Resource**, **Summary**, **Status**, **Details** (View button).

Description: `Operational traceability across warehouse actions. Click a row or View for full before/after state.`

## Filters

FilterPanel: **Audit log filters**

| Field | Notes |
| --- | --- |
| Search | placeholder `Action, email, resource…` |
| Company | All clients |
| Actor email | Exact email |
| Role | All roles; Super admin; Admin (`wh_manager`); Worker (`wh_operator`); Finance |
| Action | text/select as coded |
| Resource type | text/select as coded |
| Date from / Date to | dates |

Apply / Reset. May show total-capped warning when results hit query count cap.

## Actions

- View detail
- Export CSV
- Pagination (Previous/Next, rows per page)

## Dialogs

- **AuditLogDetailModal** — title `{action} · {resourceId truncated}` or `Audit event`; Close; loading `Loading event details…`

## Drawers

- None.

## Empty states

- `No audit events match the current filters.`

## Loading states

- DataTable loading; detail modal loading copy.

## Validation

- Export may toast `Export is disabled on this environment.` or success/failure messages.

## Permissions

- Route/nav: sa/mgr/finance.
- No extra mutate role — read + export.

## Relationships with other pages

- Detail modal is in-page; no mandatory deep link out

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
