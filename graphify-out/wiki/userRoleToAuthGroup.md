# userRoleToAuthGroup

> 12 nodes · cohesion 0.18

## Key Concepts

- **userRoleToAuthGroup()** (10 connections) — `backend/src/common/auth/auth-groups.ts`
- **UpdateProfileDto** (8 connections) — `backend/src/modules/auth/dto/update-profile.dto.ts`
- **.updateProfile()** (7 connections) — `backend/src/modules/auth/auth.controller.ts`
- **.updateProfile()** (6 connections) — `backend/src/modules/auth/auth.service.ts`
- **.getProfile()** (5 connections) — `backend/src/modules/auth/auth.service.ts`
- **update-profile.dto.ts** (4 connections) — `backend/src/modules/auth/dto/update-profile.dto.ts`
- **roleToAuthGroup()** (2 connections) — `backend/src/common/auth/rbac-policy.ts`
- **.canActivate()** (2 connections) — `backend/src/common/auth/roles.guard.ts`
- **Patch** (1 connections)
- **IsString** (1 connections)
- **MaxLength** (1 connections)
- **MinLength** (1 connections)

## Relationships

- [@prisma/client](@prisma-client.md) (5 shared connections)
- [AuthService](AuthService.md) (3 shared connections)
- [warehouse-tasks.controller.ts](warehouse-tasks.controller.ts.md) (3 shared connections)
- [AuthController](AuthController.md) (3 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (3 shared connections)
- [rbac-policy.ts](rbac-policy.ts.md) (2 shared connections)
- [@nestjs/common](@nestjs-common.md) (2 shared connections)
- [MediaStorageService](MediaStorageService.md) (1 shared connections)
- [CurrentUser](CurrentUser.md) (1 shared connections)
- [class-validator](class-validator.md) (1 shared connections)

## Source Files

- `backend/src/common/auth/auth-groups.ts`
- `backend/src/common/auth/rbac-policy.ts`
- `backend/src/common/auth/roles.guard.ts`
- `backend/src/modules/auth/auth.controller.ts`
- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/auth/dto/update-profile.dto.ts`

## Audit Trail

- EXTRACTED: 34 (94%)
- INFERRED: 2 (6%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*