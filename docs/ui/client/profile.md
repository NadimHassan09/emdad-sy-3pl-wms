# Profile

**App:** Client Portal  
**Route(s):** `/profile`  
**Source:** `client-frontend/src/pages/ProfilePage.tsx`  
**Nav label:** Profile / الملف الشخصي (footer / user menu)

## Purpose

Read-only account identity with avatar upload/remove and shortcuts to notifications and billing.

## Primary users

All authenticated client users (`client_admin`, `client_staff`).

## User goals

- Update avatar
- Confirm name, email, role, company
- Jump to notifications
- Jump to billing (admin only)
- Contact support

## Business goal

Basic self-service identity hygiene without letting merchants edit warehouse-managed identity fields.

## Main workflows

1. Upload / change / remove profile photo
2. Open Notifications card → `/notifications`
3. Open Billing card (admin) → `/billing`
4. Mailto support

## Components

- `ListPageHeader` (or page header: Profile / الملف الشخصي)
- `ImageUploadField`
- Read-only detail fields
- “Managed by warehouse” badge with tooltip
- Navigation cards
- Help / mailto block

## Forms

No editable text profile form. Avatar only via `ImageUploadField`:

| Control | EN | AR |
|---------|----|----|
| Label | Profile photo | صورة الملف الشخصي |
| Hint | Images are compressed before saving. | يتم ضغط الصور قبل الحفظ. |
| Upload | Upload photo | رفع صورة |
| Change | Change photo | تغيير الصورة |
| Uploading | Uploading… | جاري الرفع… |
| Remove | Remove | إزالة |

Read-only fields (empty → `—`): **Name** / الاسم, **Email** / البريد الإلكتروني, **Role** / الدور, **Company** / الشركة.  
Role display: **Client staff** / موظف عميل, **Client administrator** / مدير عميل.

Badge: **Managed by warehouse** / يُدار بواسطة المستودع (tooltip: Profile details are managed by your warehouse account manager. / تفاصيل الملف الشخصي يُديرها…).

## Tables

- None.

## Filters

- None.

## Actions

| Control | EN | AR | Gate |
|---------|----|----|------|
| Upload/change/remove photo | as above | as above | authenticated |
| Notifications card | Notifications / View and manage your notification preferences. | الإشعارات / عرض وإدارة تفضيلات… | all roles |
| Billing card | Billing / Review invoices, payments, and subscription. | الفوترة / مراجعة الفواتير… | `isClientAdmin` only |
| Contact support | Contact support | تواصل مع الدعم | mailto `support@emdadsy.com`, subject `Client Portal support` |

Help: **Need help?** / تحتاج مساعدة؟ + warehouse account manager copy.

## Dialogs

- Upload UX via image field (no separate modal).

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- Missing profile fields show `—`. No list empty state.

## Loading states

- Image field shows **Uploading…** / جاري الرفع… during upload.
- Layout Suspense / query pending as applicable.

## Validation

`ImageUploadField`:  
- **Please choose a valid image file.** / يرجى اختيار صورة صالحة.  
- **Image must be 8 MB or smaller.** / الحد الأقصى لحجم الصورة 8 ميغابايت.  
- Upload failure surfaces `err.message` or **Upload failed.**

## Permissions

- Route: both roles (`rbac` profile group).
- Billing shortcut: `isClientAdmin(user?.role)` only; staff do not see Billing card.
- No `useClientOperationalAccess` on this page.

## Relationships with other pages

- → `/notifications`
- → `/billing` (admin)
- ← Portal user menu / footer

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
