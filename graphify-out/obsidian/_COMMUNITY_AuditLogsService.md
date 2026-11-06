---
type: community
cohesion: 0.08
members: 47
---

# AuditLogsService

**Cohesion:** 0.08 - loosely connected
**Members:** 47 nodes

## Members
- [[dot-assertRowVisible()]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[dot-assertWithinRetention()]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[dot-buildCursorClause()]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[dot-buildFilters()]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[dot-buildOrderClause()]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[dot-buildQueryContext()]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[dot-buildTenantScope()]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[dot-constructor()_218]] - code - backend/src/modules/audit-logs/audit-log-policy.config.ts
- [[dot-constructor()_219]] - code - backend/src/modules/audit-logs/audit-logs.controller.ts
- [[dot-countCapped()]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[dot-csvEscape()]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[dot-encodeCursor()]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[dot-escapeIlike()]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[dot-export()_3]] - code - backend/src/modules/audit-logs/audit-logs.controller.ts
- [[dot-export()_4]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[dot-findById()_17]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[dot-findOne()_27]] - code - backend/src/modules/audit-logs/audit-logs.controller.ts
- [[dot-getArchivalCandidates()]] - code - backend/src/modules/audit-logs/audit-logs.controller.ts
- [[dot-getArchivalCandidates()_1]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[dot-getPolicy()_2]] - code - backend/src/modules/audit-logs/audit-logs.controller.ts
- [[dot-getPolicy()_3]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[dot-list()_56]] - code - backend/src/modules/audit-logs/audit-logs.controller.ts
- [[dot-list()_57]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[dot-parseCursor()]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[dot-partitionQuarterEnd()]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[dot-readBool()]] - code - backend/src/modules/audit-logs/audit-log-policy.config.ts
- [[dot-readInt()]] - code - backend/src/modules/audit-logs/audit-log-policy.config.ts
- [[dot-resolveDateRange()]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[dot-retentionCutoffDate()]] - code - backend/src/modules/audit-logs/audit-log-policy.config.ts
- [[dot-snapshot()_1]] - code - backend/src/modules/audit-logs/audit-log-policy.config.ts
- [[dot-toCsv()]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[dot-toDetail()]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[dot-toSummary()]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[AuditLogPolicyConfig]] - code - backend/src/modules/audit-logs/audit-log-policy.config.ts
- [[AuditLogPolicySnapshot]] - code - backend/src/modules/audit-logs/audit-log-policy.config.ts
- [[AuditLogsController]] - code - backend/src/modules/audit-logs/audit-logs.controller.ts
- [[AuditLogsService]] - code - backend/src/modules/audit-logs/audit-logs.service.ts
- [[Controller_46]] - code
- [[Get_45]] - code
- [[Header_9]] - code
- [[Injectable_155]] - code
- [[Injectable_156]] - code
- [[Param_37]] - code
- [[Query_41]] - code
- [[Res_15]] - code
- [[Throttle_11]] - code
- [[UseGuards_37]] - code

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/AuditLogsService
SORT file.name ASC
```

## Connections to other communities
- 12 edges to [[_COMMUNITY_AuthPrincipal]]
- 7 edges to [[_COMMUNITY_ListAuditLogsQueryDto]]
- 6 edges to [[_COMMUNITY_AuditLogService]]
- 5 edges to [[_COMMUNITY_app.module.ts]]
- 4 edges to [[_COMMUNITY_CurrentUser]]
- 2 edges to [[_COMMUNITY_@nestjscommon]]
- 2 edges to [[_COMMUNITY_dot-fromPrincipal]]
- 1 edge to [[_COMMUNITY_WarehouseTasksService]]
- 1 edge to [[_COMMUNITY_rbac-policy.ts]]
- 1 edge to [[_COMMUNITY_@prismaclient]]
- 1 edge to [[_COMMUNITY_dot-assertCompanyAccess]]

## Top bridge nodes
- [[dot-export()_4]] - degree 12, connects to 4 communities
- [[AuditLogsService]] - degree 28, connects to 3 communities
- [[AuditLogsController]] - degree 11, connects to 3 communities
- [[dot-export()_3]] - degree 11, connects to 3 communities
- [[dot-list()_56]] - degree 7, connects to 3 communities