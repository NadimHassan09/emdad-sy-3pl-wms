# Login

**App:** Client Portal  
**Route(s):** `/login`  
**Source:** `client-frontend/src/pages/LoginPage.tsx`  
**Nav label:** — (public)

## Purpose

Authenticate merchant users into the Client Portal with email and password. Supports remembered email and UI language toggle (EN/AR).

## Primary users

Client portal users (`client_admin`, `client_staff`) before session establishment.

## User goals

- Sign in securely
- Remember email for next visit
- Switch EN/AR language
- Understand why access is blocked (inactive company → redirect)

## Business goal

Gate all merchant self-service and warehouse visibility behind authenticated company-scoped sessions.

## Main workflows

1. Enter credentials → submit → session established → redirect to `/dashboard` (or `location.state.from`)
2. Inactive/suspended company → redirect `/account-inactive` (no inline error on login)
3. Already authenticated → redirect home
4. Toggle language (top-right) between English / العربية

## Components

- Custom login layout (not `@ds LoginScreen` wrapper name in page; centered card)
- Language toggle button
- Email / password fields with show/hide password control
- Remember-me checkbox
- Error alert area
- Submit button with loading label

## Forms

| Field | Label EN | Label AR | Notes |
|-------|----------|----------|-------|
| Email | Email | البريد الإلكتروني | `type="email"`, HTML `required`, placeholder `you@company.com` |
| Password | Password | كلمة المرور | HTML `required`, placeholder `••••••••`; aria Show/Hide password / إظهار/إخفاء كلمة المرور |
| Remember | Remember me for 30 days | تذكرني لمدة 30 يومًا | Checkbox |

Hero copy: **Welcome back** / مرحبًا بعودتك; **Sign in to manage orders, COD, and inventory.** / سجّل الدخول لإدارة الطلبات والتحصيل والمخزون.

## Tables

- None.

## Filters

- None.

## Actions

| Control | EN | AR |
|---------|----|----|
| Submit | Sign in | تسجيل الدخول |
| Submitting | Signing in… | جاري تسجيل الدخول… |
| Language | English (when UI is AR) / العربية (when UI is EN) | — |

## Dialogs

- None.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- N/A.

## Loading states

- Full-page **Loading…** / جاري التحميل… while auth `!bootstrapped`.
- Button shows **Signing in…** / جاري تسجيل الدخول… during submit.

## Validation

- Browser HTML5 `required` on email and password.
- Inline errors from `getLoginErrorMessage` (`utils/loginError.ts`):
  - Rate limit (429 / `TOO_MANY_REQUESTS`): **Too many sign-in attempts. Please wait about a minute and try again.** / محاولات تسجيل دخول كثيرة…
  - Generic: **Sign-in failed.** / فشل تسجيل الدخول.
  - Otherwise server `Error.message` as-is.
- Inactive account does not show inline error; navigates to `/account-inactive`.

## Permissions

Public route. No RBAC. Session invalidation redirects here. No `useClientOperationalAccess`.

## Relationships with other pages

- → `/dashboard` on success (or saved `from`)
- → `/account-inactive` when company inactive
- ← Any protected route via RequireAuth

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
