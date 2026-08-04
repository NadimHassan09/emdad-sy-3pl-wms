# Notifications (Admin)

**App:** Admin Dashboard
**Route(s):** `/notifications`
**Source:** `frontend/src/modules/notifications/NotificationsPage.tsx`
**Nav label:** Notifications

## Purpose

In-app alerts for warehouse users with read filters, mark-all-read, and deep links via `adminNotificationHref`.

## Primary users

All authenticated internal roles (`super_admin`, `wh_manager`, `wh_operator`, `finance`) — nav + route group `notifications` uses `ALL_ROLES`.

## User goals

- Triage unread alerts
- Open deep link to related entity
- Mark all read

## Business goal

Realtime ops awareness across orders, billing, and warehouse workflows.

## Main workflows

1. Filter All / Unread / Read → click item (marks read if unread) → navigate href when present
2. Mark all read when unreadCount > 0
3. Paginate (page size 20)

## Components

- Page title `Notifications`
- Filter tab buttons: All, Unread, Read
- Card list of notification title/body/time
- Pagination Previous / Next
- Error banner + Retry

## Forms

- None.

## Tables

- Not a DataTable — list rows show **title**, **body**, relative **createdAt** time. Unread rows highlighted.

## Filters

Tab filter modes: **All** | **Unread** | **Read** (`NotificationReadFilter`). Changing filter resets to page 0.

## Actions

- Mark all read
- Open notification (mark read + navigate)
- Previous / Next page (`Page {n} of {totalPages}`)
- Retry on error

## Dialogs

- None.

## Drawers

- None.

## Empty states

- Title `No notifications yet`
- Description `Alerts from orders, billing, and warehouse workflows appear here.`

## Loading states

- `Loading notifications…`

## Validation

- N/A.

## Permissions

- All authenticated roles. No role-specific action gates on the page.

## Relationships with other pages

- Deep links via `adminNotificationHref(notification)` into orders/tasks/billing (and related entities as mapped)

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
