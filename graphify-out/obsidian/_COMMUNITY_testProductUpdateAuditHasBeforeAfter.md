---
type: community
cohesion: 0.50
members: 9
---

# testProductUpdateAuditHasBeforeAfter

**Cohesion:** 0.50 - moderately connected
**Members:** 9 nodes

## Members
- [[companyAccessMock()]] - code - backend/src/integration-tests/audit-mutations.integration.ts
- [[deleteProduct()]] - code - backend/src/integration-tests/audit-mutations.integration.ts
- [[fetchProductAudits()]] - code - backend/src/integration-tests/audit-mutations.integration.ts
- [[realtimeMock()]] - code - backend/src/integration-tests/audit-mutations.integration.ts
- [[superAdmin()]] - code - backend/src/integration-tests/audit-mutations.integration.ts
- [[testAuditSurvivesCommittedTransaction()]] - code - backend/src/integration-tests/audit-mutations.integration.ts
- [[testNoDuplicateAuditOnRetry()]] - code - backend/src/integration-tests/audit-mutations.integration.ts
- [[testProductCreateAudit()]] - code - backend/src/integration-tests/audit-mutations.integration.ts
- [[testProductUpdateAuditHasBeforeAfter()]] - code - backend/src/integration-tests/audit-mutations.integration.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/testProductUpdateAuditHasBeforeAfter
SORT file.name ASC
```

## Connections to other communities
- 13 edges to [[_COMMUNITY_AuditLogService]]
- 7 edges to [[_COMMUNITY_ProductsService]]
- 1 edge to [[_COMMUNITY_WarehouseTasksService]]
- 1 edge to [[_COMMUNITY_dot-fromPrincipal]]

## Top bridge nodes
- [[testAuditSurvivesCommittedTransaction()]] - degree 7, connects to 3 communities
- [[testProductUpdateAuditHasBeforeAfter()]] - degree 10, connects to 2 communities
- [[testNoDuplicateAuditOnRetry()]] - degree 9, connects to 2 communities
- [[testProductCreateAudit()]] - degree 9, connects to 2 communities
- [[deleteProduct()]] - degree 5, connects to 1 community