# Not found

**App:** Client Portal  
**Route(s):** Authenticated unknown paths → `NotFoundPage`; unauthenticated catch-all typically → `/login`  
**Source:** `client-frontend/src/pages/NotFoundPage.tsx`  
**Nav label:** —

## Purpose

Soft 404 inside the authenticated portal shell.

## Primary users

Authenticated users hitting unknown URLs.

## User goals

- Recover to a known page (dashboard)

## Business goal

Avoid dead ends that look like outages.

## Main workflows

1. Show message → **Back to dashboard** → `/dashboard`

## Components

- Centered message block inside portal layout
- Primary CTA button

## Forms

- None.

## Tables

- None.

## Filters

- None.

## Actions

| Control | EN | AR |
|---------|----|----|
| CTA | Back to dashboard | العودة إلى لوحة التحكم |

Document title: **Page not found** / الصفحة غير موجودة.

## Dialogs

- None.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

Page copy (EN / AR):  
- **Page not found** / الصفحة غير موجودة  
- **This link is not part of the Client Portal. Return to the dashboard or use the sidebar.** / هذا الرابط غير موجود في بوابة العميل. عد إلى لوحة التحكم أو استخدم القائمة الجانبية.

## Loading states

- None.

## Validation

- N/A.

## Permissions

Any authenticated `client_admin` / `client_staff`. No extra gate. No `useClientOperationalAccess`.

## Relationships with other pages

- → `/dashboard`

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
