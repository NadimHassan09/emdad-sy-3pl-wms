# rbac-policy.ts

> 23 nodes · cohesion 0.17

## Key Concepts

- **rbac-policy.ts** (22 connections) — `backend/src/common/auth/rbac-policy.ts`
- **internal-rbac.ts** (20 connections) — `backend/src/common/auth/internal-rbac.ts`
- **assertInternalAdmin()** (12 connections) — `backend/src/common/auth/internal-rbac.ts`
- **isInternalAdminRole()** (11 connections) — `backend/src/common/auth/rbac-policy.ts`
- **assertCanManageTargetRole()** (8 connections) — `backend/src/common/auth/internal-rbac.ts`
- **assertCanCreateTargetRole()** (6 connections) — `backend/src/common/auth/internal-rbac.ts`
- **canManageTargetRole()** (6 connections) — `backend/src/common/auth/rbac-policy.ts`
- **rbac-policy.unit.spec.ts** (6 connections) — `backend/src/common/auth/rbac-policy.unit.spec.ts`
- **.adjustShippingFeeBulk()** (6 connections) — `backend/src/modules/oms/oms-bulk.service.ts`
- **assertCanEditExistingUser()** (5 connections) — `backend/src/common/auth/internal-rbac.ts`
- **assertCanSetOtherUserPassword()** (5 connections) — `backend/src/common/auth/internal-rbac.ts`
- **canCreateTargetRole()** (5 connections) — `backend/src/common/auth/rbac-policy.ts`
- **isInternalAdmin()** (4 connections) — `backend/src/common/auth/internal-rbac.ts`
- **canEditExistingUsers()** (4 connections) — `backend/src/common/auth/rbac-policy.ts`
- **canSetOtherUserPassword()** (4 connections) — `backend/src/common/auth/rbac-policy.ts`
- **.canActivate()** (2 connections) — `backend/src/common/auth/internal-admin.guard.ts`
- **canManageWarehouseUsers()** (2 connections) — `backend/src/common/auth/internal-rbac.ts`
- **roleRank()** (2 connections) — `backend/src/common/auth/rbac-policy.ts`
- **TENANT_SCOPE_REQUIRED_MESSAGE** (2 connections) — `backend/src/common/auth/rbac-policy.ts`
- **isWarehouseOperator()** (1 connections) — `backend/src/common/auth/internal-rbac.ts`
- **AUTH_GROUP_ADMIN_ROLES** (1 connections) — `backend/src/common/auth/rbac-policy.ts`
- **INTERNAL_ADMIN_ROLES** (1 connections) — `backend/src/common/auth/rbac-policy.ts`
- **ROLE_RANK** (1 connections) — `backend/src/common/auth/rbac-policy.ts`

## Relationships

- [@prisma/client](@prisma-client.md) (12 shared connections)
- [UsersService](UsersService.md) (10 shared connections)
- [@nestjs/common](@nestjs-common.md) (4 shared connections)
- [observability.service.ts](observability.service.ts.md) (3 shared connections)
- [withTenantRls](withTenantRls.md) (3 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (2 shared connections)
- [AuditLogService](AuditLogService.md) (2 shared connections)
- [warehouse-tasks.controller.ts](warehouse-tasks.controller.ts.md) (2 shared connections)
- [userRoleToAuthGroup](userRoleToAuthGroup.md) (2 shared connections)
- [oms-bulk.service.ts](oms-bulk.service.ts.md) (2 shared connections)
- [outbound.service.ts](outbound.service.ts.md) (2 shared connections)
- [UsersController](UsersController.md) (1 shared connections)

## Source Files

- `backend/src/common/auth/internal-admin.guard.ts`
- `backend/src/common/auth/internal-rbac.ts`
- `backend/src/common/auth/rbac-policy.ts`
- `backend/src/common/auth/rbac-policy.unit.spec.ts`
- `backend/src/modules/oms/oms-bulk.service.ts`

## Audit Trail

- EXTRACTED: 90 (98%)
- INFERRED: 2 (2%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*