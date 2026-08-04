# Account inactive

**App:** Client Portal  
**Route(s):** `/account-inactive`  
**Source:** `client-frontend/src/pages/AccountStatusPage.tsx`  
**Nav label:** — (public)

## Purpose

Explain that the merchant company account cannot use the portal (suspended/inactive/archived) and provide support contact.

## Primary users

Users whose company status blocks portal login.

## User goals

- Understand lockout reason
- Contact support
- Return to login

## Business goal

Prevent operational use of suspended accounts while keeping a clear human path to reactivation.

## Main workflows

1. Land after blocked login → read message → mailto support or back to login

## Components

- Centered status card
- Heading + body paragraphs
- Support mailto link
- Back-to-login link/button

## Forms

- None.

## Tables

- None.

## Filters

- None.

## Actions

| Control | EN | AR | Target |
|---------|----|----|--------|
| Contact support | Contact support | تواصل مع الدعم | `mailto:support@emdadsy.com` |
| Back to login | Back to login | العودة لتسجيل الدخول | `/login` |

## Dialogs

- None.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- N/A — page is itself a status message.

**Copy (EN / AR)**  
- Title: **Your account is inactive** / حسابك غير نشط حاليا  
- Body: Access to this portal has been temporarily disabled… / تم تعطيل الوصول إلى هذه البوابة مؤقتا…  
- Support prompt: **Please contact support to restore access.** / يرجى التواصل مع الدعم لاستعادة الوصول.

## Loading states

- None specific (static page after redirect).

## Validation

- N/A.

## Permissions

Public. No RBAC / no `useClientOperationalAccess`.

## Relationships with other pages

- ← Login when company inactive/suspended
- → `/login`

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
