# .login

> 12 nodes · cohesion 0.29

## Key Concepts

- **.login()** (12 connections) — `backend/src/modules/client-portal/auth/client-auth.service.ts`
- **.login()** (11 connections) — `backend/src/modules/auth/auth.service.ts`
- **.completeLogin()** (11 connections) — `backend/src/modules/auth/google-oauth.service.ts`
- **.hash()** (7 connections) — `backend/src/common/crypto/password.service.ts`
- **getClientIp()** (7 connections) — `backend/src/common/security/request-ip.util.ts`
- **.verify()** (6 connections) — `backend/src/common/crypto/password.service.ts`
- **.assertAllowed()** (4 connections) — `backend/src/common/security/login-brute-force.service.ts`
- **.recordFailure()** (4 connections) — `backend/src/common/security/login-brute-force.service.ts`
- **.recordSuccess()** (4 connections) — `backend/src/common/security/login-brute-force.service.ts`
- **.isLegacyScrypt()** (3 connections) — `backend/src/common/crypto/password.service.ts`
- **verifyScrypt()** (2 connections) — `backend/src/common/crypto/password.service.ts`
- **.expiresInToMs()** (2 connections) — `backend/src/modules/client-portal/auth/client-auth.service.ts`

## Relationships

- [@nestjs/common](@nestjs-common.md) (8 shared connections)
- [@prisma/client](@prisma-client.md) (6 shared connections)
- [GoogleOAuthService](GoogleOAuthService.md) (6 shared connections)
- [AuthService](AuthService.md) (5 shared connections)
- [AuditLogService](AuditLogService.md) (4 shared connections)
- [UsersService](UsersService.md) (2 shared connections)
- [.fromPrincipal](fromPrincipal.md) (2 shared connections)
- [LoginDto](LoginDto.md) (1 shared connections)
- [AuthController](AuthController.md) (1 shared connections)

## Source Files

- `backend/src/common/crypto/password.service.ts`
- `backend/src/common/security/login-brute-force.service.ts`
- `backend/src/common/security/request-ip.util.ts`
- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/auth/google-oauth.service.ts`
- `backend/src/modules/client-portal/auth/client-auth.service.ts`

## Audit Trail

- EXTRACTED: 28 (52%)
- INFERRED: 26 (48%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*