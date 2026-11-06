---
type: community
cohesion: 0.17
members: 32
---

# WorkflowApi

**Cohesion:** 0.17 - loosely connected
**Members:** 32 nodes

## Members
- [[dot-assignStart()]] - code - tests/helpers/workflow-fixture.ts
- [[dot-call()]] - code - tests/helpers/workflow-fixture.ts
- [[dot-cancelActiveCycleCounts()]] - code - tests/helpers/workflow-fixture.ts
- [[dot-completeDispatch()]] - code - tests/helpers/workflow-fixture.ts
- [[dot-completePack()]] - code - tests/helpers/workflow-fixture.ts
- [[dot-completePick()]] - code - tests/helpers/workflow-fixture.ts
- [[dot-completePutaway()_1]] - code - tests/helpers/workflow-fixture.ts
- [[dot-completeReceiving()_1]] - code - tests/helpers/workflow-fixture.ts
- [[dot-constructor()_31]] - code - tests/helpers/workflow-fixture.ts
- [[dot-create()_1]] - code - tests/helpers/workflow-fixture.ts
- [[dot-createInbound()]] - code - tests/helpers/workflow-fixture.ts
- [[dot-createOutbound()]] - code - tests/helpers/workflow-fixture.ts
- [[dot-createProduct()]] - code - tests/helpers/workflow-fixture.ts
- [[dot-ensureWorkerId()]] - code - tests/helpers/workflow-fixture.ts
- [[dot-getAuditLogs()]] - code - tests/helpers/workflow-fixture.ts
- [[dot-getStock()]] - code - tests/helpers/workflow-fixture.ts
- [[dot-getTasksByReference()]] - code - tests/helpers/workflow-fixture.ts
- [[dot-getWarehouseAndLocations()]] - code - tests/helpers/workflow-fixture.ts
- [[dot-runCycleCountExecution()]] - code - tests/helpers/workflow-fixture.ts
- [[dot-runReturnLifecycle()]] - code - tests/helpers/workflow-fixture.ts
- [[dot-seedStock()]] - code - tests/helpers/workflow-fixture.ts
- [[dot-shipOutbound()]] - code - tests/helpers/workflow-fixture.ts
- [[R3AccountContext]] - code - tests/helpers/release-r3-accounts.ts
- [[R3_ACCOUNTS]] - code - tests/helpers/release-r3-accounts.ts
- [[WorkflowApi]] - code - tests/helpers/workflow-fixture.ts
- [[adminApi()]] - code - tests/helpers/auth.ts
- [[completeCycleCountViaApi()]] - code - tests/e2e/admin/realtime-ops.spec.ts
- [[ensureR3Accounts()]] - code - tests/helpers/release-r3-accounts.ts
- [[ensureSystemUser()]] - code - tests/helpers/release-r3-accounts.ts
- [[findUserByEmail()]] - code - tests/helpers/release-r3-accounts.ts
- [[loginInternal()]] - code - tests/helpers/auth.ts
- [[release-r3-accounts.ts]] - code - tests/helpers/release-r3-accounts.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/WorkflowApi
SORT file.name ASC
```

## Connections to other communities
- 20 edges to [[_COMMUNITY_adminLogin]]
- 4 edges to [[_COMMUNITY_release-r3-workflow.spec.ts]]
- 1 edge to [[_COMMUNITY_ref_playwright_test]]

## Top bridge nodes
- [[release-r3-accounts.ts]] - degree 14, connects to 3 communities
- [[WorkflowApi]] - degree 35, connects to 2 communities
- [[dot-call()]] - degree 21, connects to 1 community
- [[ensureR3Accounts()]] - degree 7, connects to 1 community
- [[adminApi()]] - degree 5, connects to 1 community