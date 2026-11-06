---
type: community
cohesion: 0.25
members: 16
---

# release-r3-workflow.spec.ts

**Cohesion:** 0.25 - loosely connected
**Members:** 16 nodes

## Members
- [[assignWorkerAndStart()]] - code - tests/helpers/release-r3-ui.ts
- [[comboboxRoot()]] - code - tests/helpers/release-r3-ui.ts
- [[completeDispatch()]] - code - tests/helpers/release-r3-ui.ts
- [[completePack()]] - code - tests/helpers/release-r3-ui.ts
- [[completePick()]] - code - tests/helpers/release-r3-ui.ts
- [[completePutaway()]] - code - tests/helpers/release-r3-ui.ts
- [[completeQcPass()]] - code - tests/helpers/release-r3-ui.ts
- [[completeReceiving()]] - code - tests/helpers/release-r3-ui.ts
- [[fillOrderDraftLine()]] - code - tests/helpers/release-r3-ui.ts
- [[openTimelineTask()]] - code - tests/helpers/release-r3-ui.ts
- [[release-r3-ui.ts]] - code - tests/helpers/release-r3-ui.ts
- [[release-r3-workflow.spec.ts]] - code - tests/e2e/admin/release-r3-workflow.spec.ts
- [[selectComboboxByLabel()]] - code - tests/helpers/release-r3-ui.ts
- [[selectFirstComboboxOption()]] - code - tests/helpers/release-r3-ui.ts
- [[switchAdminUser()]] - code - tests/helpers/release-r3-ui.ts
- [[waitForOrderStatus()]] - code - tests/helpers/release-r3-ui.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/release-r3-workflowspects
SORT file.name ASC
```

## Connections to other communities
- 9 edges to [[_COMMUNITY_adminLogin]]
- 4 edges to [[_COMMUNITY_WorkflowApi]]
- 2 edges to [[_COMMUNITY_ref_node_path]]
- 2 edges to [[_COMMUNITY_ref_playwright_test]]

## Top bridge nodes
- [[release-r3-workflow.spec.ts]] - degree 25, connects to 4 communities
- [[release-r3-ui.ts]] - degree 20, connects to 2 communities
- [[switchAdminUser()]] - degree 3, connects to 1 community