# O-13 — Google Sheets 403 access_denied (14 Nov 2026)

## What the owner saw

Google OAuth error (Arabic):

> تم حظر إمكانية الوصول: لم يكمل تطبيق **emdadsy.com** عملية التحقّق التي تفرضها Google  
> التطبيق حالياً في وضع الاختبار ولا يمكن الوصول إليه إلا من مختبرين وافق عليهم المطوّر.  
> **خطأ 403: access_denied**

## Root cause (not an EMDAD code bug)

The Google Cloud OAuth client for `emdadsy.com` is in **Publishing status = Testing**.  
In that mode Google only allows accounts listed under **Audience → Test users**. Any other Google account (including the owner if not listed) gets `403 access_denied`.

This matches Google’s standard behaviour; the staging Sheets connect button is working as designed until the Cloud project is fixed.

## Fix (owner / Google Cloud Console)

1. Open [Google Cloud Console](https://console.cloud.google.com/) → the project that owns the Sheets OAuth client used in staging admin **Settings → Google OAuth**.
2. **APIs & Services → OAuth consent screen**:
   - Either add the Google accounts that will test Sheets under **Test users**, **or**
   - Submit the app for **Verification** and set Publishing status to **In production** (required for real client use).
3. Confirm authorized redirect URIs include the staging/client callback URLs used by EMDAD (do not change secrets in chat).
4. Retry: client portal → Sheets → Sign in with Google → create sheet → edit after approval should be rejected by our lock rules.

## EMDAD code status

- OAuth + Sheets sync code is already in tree (`client-sheets-google.service.ts`).
- D-043 (401 on status) was fixed earlier.
- No code change required for this 403; unblock is **Google Console configuration**.
