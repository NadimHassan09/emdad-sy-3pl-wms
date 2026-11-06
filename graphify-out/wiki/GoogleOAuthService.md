# GoogleOAuthService

> 25 nodes · cohesion 0.17

## Key Concepts

- **GoogleOAuthService** (30 connections) — `backend/src/modules/auth/google-oauth.service.ts`
- **.handleCallback()** (11 connections) — `backend/src/modules/auth/google-oauth.service.ts`
- **.buildLinkUrl()** (6 connections) — `backend/src/modules/auth/google-oauth.service.ts`
- **.completeLink()** (6 connections) — `backend/src/modules/auth/google-oauth.service.ts`
- **.assertConfigured()** (5 connections) — `backend/src/modules/auth/google-oauth.service.ts`
- **.auditAnonymous()** (5 connections) — `backend/src/modules/auth/google-oauth.service.ts`
- **.buildLoginUrl()** (5 connections) — `backend/src/modules/auth/google-oauth.service.ts`
- **.buildGoogleAuthUrl()** (4 connections) — `backend/src/modules/auth/google-oauth.service.ts`
- **.createOAuthClient()** (4 connections) — `backend/src/modules/auth/google-oauth.service.ts`
- **.frontendOrigin()** (4 connections) — `backend/src/modules/auth/google-oauth.service.ts`
- **.isConfigured()** (4 connections) — `backend/src/modules/auth/google-oauth.service.ts`
- **.linkSuccessUrl()** (4 connections) — `backend/src/modules/auth/google-oauth.service.ts`
- **.redirectFailure()** (4 connections) — `backend/src/modules/auth/google-oauth.service.ts`
- **.signState()** (4 connections) — `backend/src/modules/auth/google-oauth.service.ts`
- **.constructor()** (3 connections) — `backend/src/modules/auth/auth.controller.ts`
- **.exchangeCodeForIdentity()** (3 connections) — `backend/src/modules/auth/google-oauth.service.ts`
- **.failureUrl()** (3 connections) — `backend/src/modules/auth/google-oauth.service.ts`
- **.getStatus()** (3 connections) — `backend/src/modules/auth/google-oauth.service.ts`
- **.redirectLinkFailure()** (3 connections) — `backend/src/modules/auth/google-oauth.service.ts`
- **.signingSecret()** (3 connections) — `backend/src/modules/auth/google-oauth.service.ts`
- **.successUrl()** (3 connections) — `backend/src/modules/auth/google-oauth.service.ts`
- **.verifyState()** (3 connections) — `backend/src/modules/auth/google-oauth.service.ts`
- **.envBool()** (2 connections) — `backend/src/modules/auth/google-oauth.service.ts`
- **.mapErrorToQuery()** (2 connections) — `backend/src/modules/auth/google-oauth.service.ts`
- **Injectable** (1 connections)

## Relationships

- [.login](login.md) (6 shared connections)
- [AuthController](AuthController.md) (5 shared connections)
- [.fromPrincipal](fromPrincipal.md) (3 shared connections)
- [AuditLogService](AuditLogService.md) (2 shared connections)
- [AuthService](AuthService.md) (1 shared connections)
- [@nestjs/common](@nestjs-common.md) (1 shared connections)
- [app.module.ts](app.module.ts.md) (1 shared connections)
- [.assertCompanyAccess](assertCompanyAccess.md) (1 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (1 shared connections)

## Source Files

- `backend/src/modules/auth/auth.controller.ts`
- `backend/src/modules/auth/google-oauth.service.ts`

## Audit Trail

- EXTRACTED: 66 (90%)
- INFERRED: 7 (10%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*