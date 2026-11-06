---
type: community
cohesion: 0.17
members: 23
---

# rbac-policy.ts

**Cohesion:** 0.17 - loosely connected
**Members:** 23 nodes

## Members
- [[dot-adjustShippingFeeBulk()]] - code - backend/src/modules/oms/oms-bulk.service.ts
- [[dot-canActivate()_2]] - code - backend/src/common/auth/internal-admin.guard.ts
- [[AUTH_GROUP_ADMIN_ROLES]] - code - backend/src/common/auth/rbac-policy.ts
- [[INTERNAL_ADMIN_ROLES]] - code - backend/src/common/auth/rbac-policy.ts
- [[ROLE_RANK]] - code - backend/src/common/auth/rbac-policy.ts
- [[TENANT_SCOPE_REQUIRED_MESSAGE]] - code - backend/src/common/auth/rbac-policy.ts
- [[assertCanCreateTargetRole()]] - code - backend/src/common/auth/internal-rbac.ts
- [[assertCanEditExistingUser()]] - code - backend/src/common/auth/internal-rbac.ts
- [[assertCanManageTargetRole()]] - code - backend/src/common/auth/internal-rbac.ts
- [[assertCanSetOtherUserPassword()]] - code - backend/src/common/auth/internal-rbac.ts
- [[assertInternalAdmin()]] - code - backend/src/common/auth/internal-rbac.ts
- [[canCreateTargetRole()]] - code - backend/src/common/auth/rbac-policy.ts
- [[canEditExistingUsers()]] - code - backend/src/common/auth/rbac-policy.ts
- [[canManageTargetRole()]] - code - backend/src/common/auth/rbac-policy.ts
- [[canManageWarehouseUsers()]] - code - backend/src/common/auth/internal-rbac.ts
- [[canSetOtherUserPassword()]] - code - backend/src/common/auth/rbac-policy.ts
- [[internal-rbac.ts]] - code - backend/src/common/auth/internal-rbac.ts
- [[isInternalAdmin()]] - code - backend/src/common/auth/internal-rbac.ts
- [[isInternalAdminRole()]] - code - backend/src/common/auth/rbac-policy.ts
- [[isWarehouseOperator()]] - code - backend/src/common/auth/internal-rbac.ts
- [[rbac-policy.ts]] - code - backend/src/common/auth/rbac-policy.ts
- [[rbac-policy.unit.spec.ts]] - code - backend/src/common/auth/rbac-policy.unit.spec.ts
- [[roleRank()]] - code - backend/src/common/auth/rbac-policy.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/rbac-policyts
SORT file.name ASC
```

## Connections to other communities
- 12 edges to [[_COMMUNITY_@prismaclient]]
- 10 edges to [[_COMMUNITY_UsersService]]
- 4 edges to [[_COMMUNITY_@nestjscommon]]
- 3 edges to [[_COMMUNITY_withTenantRls]]
- 3 edges to [[_COMMUNITY_observability.service.ts]]
- 2 edges to [[_COMMUNITY_warehouse-tasks.controller.ts]]
- 2 edges to [[_COMMUNITY_AuthPrincipal]]
- 2 edges to [[_COMMUNITY_AuditLogService]]
- 2 edges to [[_COMMUNITY_oms-bulk.service.ts]]
- 2 edges to [[_COMMUNITY_outbound.service.ts]]
- 2 edges to [[_COMMUNITY_userRoleToAuthGroup]]
- 1 edge to [[_COMMUNITY_AdjustShippingFeeBulkDto]]
- 1 edge to [[_COMMUNITY_UsersController]]
- 1 edge to [[_COMMUNITY_AuditLogsService]]
- 1 edge to [[_COMMUNITY_CurrentUser]]

## Top bridge nodes
- [[rbac-policy.ts]] - degree 22, connects to 7 communities
- [[isInternalAdminRole()]] - degree 11, connects to 5 communities
- [[internal-rbac.ts]] - degree 20, connects to 4 communities
- [[assertInternalAdmin()]] - degree 12, connects to 4 communities
- [[dot-adjustShippingFeeBulk()]] - degree 6, connects to 4 communities