---
type: community
cohesion: 0.11
members: 27
---

# oms/oms-operational-stage.ts

**Cohesion:** 0.11 - loosely connected
**Members:** 27 nodes

## Members
- [[BatchMemberSnapshot]] - code - backend/src/modules/oms/oms-batch-summary.ts
- [[BatchSummary]] - code - backend/src/modules/oms/oms-batch-summary.ts
- [[DELIVERED_STATUSES]] - code - backend/src/modules/oms/oms-batch-summary.ts
- [[DONE_STATUSES]] - code - backend/src/modules/oms/oms-batch-summary.ts
- [[ISSUE_STATUSES]] - code - backend/src/modules/oms/oms-batch-summary.ts
- [[OMS_LIST_STATUS_EXPANSIONS]] - code - backend/src/modules/oms/oms-operational-stage.ts
- [[OMS_NAV_STATUS_KEYS]] - code - backend/src/modules/oms/oms-operational-stage.ts
- [[OmsOperationalStage]] - code - backend/src/modules/oms/oms-operational-stage.ts
- [[PICKING_OUTBOUND_STATUSES]] - code - backend/src/modules/oms/oms-operational-stage.ts
- [[SHIPPED_STATUSES]] - code - backend/src/modules/oms/oms-batch-summary.ts
- [[SHIPPING_DETAILS_OUTBOUND_STATUSES]] - code - backend/src/modules/oms/oms-operational-stage.ts
- [[buildOperationalStageWhere()]] - code - backend/src/modules/oms/oms-operational-stage.ts
- [[isBatchIssue()]] - code - backend/src/modules/oms/oms-batch-summary.ts
- [[isOmsOperationalStage()]] - code - backend/src/modules/oms/oms-operational-stage.ts
- [[isPacked()]] - code - backend/src/modules/oms/oms-batch-summary.ts
- [[isPicked()]] - code - backend/src/modules/oms/oms-batch-summary.ts
- [[isReadyToShip()]] - code - backend/src/modules/oms/oms-batch-summary.ts
- [[oms-batch-summary.ts]] - code - backend/src/modules/oms/oms-batch-summary.ts
- [[oms-batch-summary.unit.spec.ts]] - code - backend/src/modules/oms/oms-batch-summary.unit.spec.ts
- [[oms-ready-to-ship-lifecycle.unit.spec.ts]] - code - backend/src/modules/oms/oms-ready-to-ship-lifecycle.unit.spec.ts
- [[omsoms-operational-stage.ts]] - code - backend/src/modules/oms/oms-operational-stage.ts
- [[omsoms-operational-stage.unit.spec.ts]] - code - backend/src/modules/oms/oms-operational-stage.unit.spec.ts
- [[omsNavStatusBucket()]] - code - backend/src/modules/oms/oms-operational-stage.ts
- [[operationalKey()]] - code - backend/src/modules/oms/oms-batch-summary.ts
- [[shipmentNotSentWhere()]] - code - backend/src/modules/oms/oms-operational-stage.ts
- [[shipmentSentWhere()]] - code - backend/src/modules/oms/oms-operational-stage.ts
- [[summarizeBatchMembers()]] - code - backend/src/modules/oms/oms-batch-summary.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/oms/oms-operational-stagets
SORT file.name ASC
```

## Connections to other communities
- 6 edges to [[_COMMUNITY_@prismaclient]]
- 5 edges to [[_COMMUNITY_withTenantRls]]
- 5 edges to [[_COMMUNITY_outbound.service.ts]]
- 3 edges to [[_COMMUNITY_EmptyToUndefined]]
- 2 edges to [[_COMMUNITY_OmsBatchMembershipDto]]
- 2 edges to [[_COMMUNITY_shipping-tracking.service.ts]]
- 2 edges to [[_COMMUNITY_oms-instruction-pdf.service.ts]]

## Top bridge nodes
- [[omsoms-operational-stage.ts]] - degree 20, connects to 5 communities
- [[summarizeBatchMembers()]] - degree 11, connects to 2 communities
- [[buildOperationalStageWhere()]] - degree 8, connects to 2 communities
- [[oms-ready-to-ship-lifecycle.unit.spec.ts]] - degree 8, connects to 2 communities
- [[omsNavStatusBucket()]] - degree 5, connects to 2 communities