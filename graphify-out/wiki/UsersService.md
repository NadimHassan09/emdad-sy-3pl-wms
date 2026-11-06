# UsersService

> 28 nodes · cohesion 0.14

## Key Concepts

- **UsersService** (26 connections) — `backend/src/modules/users/users.service.ts`
- **.update()** (16 connections) — `backend/src/modules/users/users.service.ts`
- **.create()** (14 connections) — `backend/src/modules/users/users.service.ts`
- **ListUsersQueryDto** (13 connections) — `backend/src/modules/users/dto/list-users-query.dto.ts`
- **.upsertWorkerProfile()** (12 connections) — `backend/src/modules/users/users.service.ts`
- **.getWorkerProfile()** (8 connections) — `backend/src/modules/users/users.service.ts`
- **.linkExistingWorker()** (7 connections) — `backend/src/modules/users/users.service.ts`
- **.list()** (7 connections) — `backend/src/modules/users/users.service.ts`
- **.toListRow()** (7 connections) — `backend/src/modules/users/users.service.ts`
- **user-worker-profile.util.ts** (6 connections) — `backend/src/modules/users/user-worker-profile.util.ts`
- **toWorkerProfileSummary()** (6 connections) — `backend/src/modules/users/user-worker-profile.util.ts`
- **.findById()** (6 connections) — `backend/src/modules/users/users.service.ts`
- **.resolveWorkerProvisionCompanyId()** (6 connections) — `backend/src/modules/users/users.service.ts`
- **UserWorkerProfileSummary** (5 connections) — `backend/src/modules/users/user-worker-profile.util.ts`
- **.buildListWhere()** (5 connections) — `backend/src/modules/users/users.service.ts`
- **.syncWorkerForSystemUser()** (5 connections) — `backend/src/modules/users/users.service.ts`
- **.resolveWorkerWarehouseId()** (4 connections) — `backend/src/modules/users/users.service.ts`
- **.serializeUserForRealtime()** (4 connections) — `backend/src/modules/users/users.service.ts`
- **.suspend()** (4 connections) — `backend/src/modules/users/users.service.ts`
- **WORKER_PROFILE_SELECT** (3 connections) — `backend/src/modules/users/user-worker-profile.util.ts`
- **.assertOperatorWorkerEligible()** (3 connections) — `backend/src/modules/users/users.service.ts`
- **DEFAULT_WORKER_ROLES** (2 connections) — `backend/src/modules/users/user-worker-profile.util.ts`
- **mapSystemRoleToUserRole()** (2 connections) — `backend/src/modules/users/users.service.ts`
- **IsIn** (1 connections)
- **IsOptional** (1 connections)
- *... and 3 more nodes in this community*

## Relationships

- [@prisma/client](@prisma-client.md) (15 shared connections)
- [UsersController](UsersController.md) (11 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (11 shared connections)
- [rbac-policy.ts](rbac-policy.ts.md) (10 shared connections)
- [.assertCompanyAccess](assertCompanyAccess.md) (6 shared connections)
- [EmptyToUndefined](EmptyToUndefined.md) (3 shared connections)
- [@nestjs/common](@nestjs-common.md) (2 shared connections)
- [CreateUserDto](CreateUserDto.md) (2 shared connections)
- [.login](login.md) (2 shared connections)
- [RealtimeService](RealtimeService.md) (2 shared connections)
- [class-validator](class-validator.md) (1 shared connections)
- [app.module.ts](app.module.ts.md) (1 shared connections)

## Source Files

- `backend/src/modules/users/dto/list-users-query.dto.ts`
- `backend/src/modules/users/user-worker-profile.util.ts`
- `backend/src/modules/users/users.service.ts`

## Audit Trail

- EXTRACTED: 103 (84%)
- INFERRED: 20 (16%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*