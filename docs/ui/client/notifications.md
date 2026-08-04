# Notifications

**App:** Client Portal  
**Route(s):** `/notifications`  
**Source:** `client-frontend/src/pages/NotificationsPage.tsx`  
**Nav label:** Notifications / الإشعارات

## Purpose

Paginated notification inbox with unread/read filters, mark-all-read, and deep-link navigation to related entities.

## Primary users

`client_admin` and `client_staff`.

## User goals

- See unread count
- Filter All / Unread / Read
- Mark all as read
- Open a notification’s related page

## Business goal

Surface warehouse/ops events so merchants act without leaving the portal.

## Main workflows

1. Load list → filter tabs (note: filter applies to current page only)
2. Click item → mark read if unread → navigate via `clientNotificationHref`
3. Mark all read when unread > 0
4. Paginate when total > 20

## Components

- `ClientPageIntro` (title + unread badge)
- Filter tablist
- Day group headers (Today / Yesterday / Earlier)
- Notification list rows (title/body from API)
- Pagination controls
- `Alert` on load error
- Skeletons / sr-only loading text

## Forms

- None (no compose form).

## Tables

- None (list feed, not a data table).

## Filters

Tablist aria-label **Notifications** / الإشعارات:

| Tab | EN | AR | Notes |
|-----|----|----|-------|
| all | All | الكل | |
| unread | Unread | غير مقروء | appends ` · {count}` when unread > 0 |
| read | Read | مقروء | |

Note when not “all”: **Filter applies to the current page only.** / الفلتر يطبّق على الصفحة الحالية فقط.

## Actions

| Control | EN | AR | Condition |
|---------|----|----|-----------|
| Mark all read | Mark all read | تعليم الكل كمقروء | `unreadCount > 0`; disabled while mutation pending |
| Retry | Retry | *(English hardcoded)* | load error |
| Previous / Next | Previous / Next | السابق / التالي | pagination |
| Item click | — | — | mark read + navigate |

Relative time: Just now / الآن; `{n}m ago` / منذ `{n}` د; `{n}h ago` / منذ `{n}` س; `{n}d ago` / منذ `{n}` ي.

Day groups: Today / اليوم, Yesterday / أمس, Earlier / أقدم.

## Dialogs

- None.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

| EN | AR |
|----|----|
| No notifications yet | لا توجد إشعارات بعد |
| Notifications from your warehouse team appear here. | إشعارات فريق المستودع تظهر هنا. |

## Loading states

- **Loading notifications…** / جاري تحميل الإشعارات… (sr-only) + pulse skeletons.
- Pagination label: **Page {n} of {total}** / صفحة {n} من {total}.

## Validation

- N/A. Load error: **Could not load notifications** / تعذر تحميل الإشعارات.

## Permissions

Both roles via notifications route group. No `useClientOperationalAccess`.

## Relationships with other pages

- Deep links to orders/products/etc. via `clientNotificationHref`
- ← Profile Notifications card
- ← Dashboard activity feed (related surface)

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
