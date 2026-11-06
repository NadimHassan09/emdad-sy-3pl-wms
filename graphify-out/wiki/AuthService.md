# AuthService

> 22 nodes · cohesion 0.21

## Key Concepts

- **AuthService** (30 connections) — `backend/src/modules/auth/auth.service.ts`
- **.issueInternalSession()** (13 connections) — `backend/src/modules/auth/auth.service.ts`
- **.refresh()** (12 connections) — `backend/src/modules/auth/auth.service.ts`
- **.logout()** (10 connections) — `backend/src/modules/auth/auth.service.ts`
- **.emitAuthSessionChanged()** (10 connections) — `backend/src/modules/realtime/realtime.service.ts`
- **.changePassword()** (8 connections) — `backend/src/modules/auth/auth.service.ts`
- **.buildCookieBase()** (7 connections) — `backend/src/modules/auth/auth.service.ts`
- **.invalidateUserSessions()** (5 connections) — `backend/src/modules/auth/refresh-session.service.ts`
- **.clearAccessCookie()** (4 connections) — `backend/src/modules/auth/auth.service.ts`
- **.clearAuthCookies()** (4 connections) — `backend/src/modules/auth/auth.service.ts`
- **.setAccessCookie()** (4 connections) — `backend/src/modules/auth/auth.service.ts`
- **.setRefreshCookie()** (4 connections) — `backend/src/modules/auth/auth.service.ts`
- **.clearRefreshCookie()** (3 connections) — `backend/src/modules/auth/auth.service.ts`
- **.expiresInToMs()** (3 connections) — `backend/src/modules/auth/auth.service.ts`
- **.readRefreshToken()** (3 connections) — `backend/src/modules/auth/auth.service.ts`
- **.signRefreshToken()** (3 connections) — `backend/src/modules/auth/auth.service.ts`
- **.tryVerifyRefreshToken()** (3 connections) — `backend/src/modules/auth/auth.service.ts`
- **.verifyRefreshToken()** (3 connections) — `backend/src/modules/auth/auth.service.ts`
- **.getCookieDomain()** (2 connections) — `backend/src/modules/auth/auth.service.ts`
- **.isProduction()** (2 connections) — `backend/src/modules/auth/auth.service.ts`
- **.createSession()** (2 connections) — `backend/src/modules/auth/refresh-session.service.ts`
- **Injectable** (1 connections)

## Relationships

- [AuditLogService](AuditLogService.md) (6 shared connections)
- [.fromPrincipal](fromPrincipal.md) (6 shared connections)
- [.login](login.md) (5 shared connections)
- [AuthController](AuthController.md) (4 shared connections)
- [RealtimeService](RealtimeService.md) (4 shared connections)
- [userRoleToAuthGroup](userRoleToAuthGroup.md) (3 shared connections)
- [@prisma/client](@prisma-client.md) (2 shared connections)
- [.assertCompanyAccess](assertCompanyAccess.md) (2 shared connections)
- [@nestjs/common](@nestjs-common.md) (1 shared connections)
- [app.module.ts](app.module.ts.md) (1 shared connections)
- [GoogleOAuthService](GoogleOAuthService.md) (1 shared connections)
- [MediaStorageService](MediaStorageService.md) (1 shared connections)

## Source Files

- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/auth/refresh-session.service.ts`
- `backend/src/modules/realtime/realtime.service.ts`

## Audit Trail

- EXTRACTED: 65 (74%)
- INFERRED: 23 (26%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*