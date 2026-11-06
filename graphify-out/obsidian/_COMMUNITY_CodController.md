---
type: community
cohesion: 0.11
members: 34
---

# CodController

**Cohesion:** 0.11 - loosely connected
**Members:** 34 nodes

## Members
- [[dot-addManualAdjustment()]] - code - backend/src/modules/cod/cod-records.service.ts
- [[dot-adjust()]] - code - backend/src/modules/cod/cod.controller.ts
- [[dot-byOrder()]] - code - backend/src/modules/cod/cod.controller.ts
- [[dot-constructor()_27]] - code - backend/src/modules/cod/cod.controller.ts
- [[dot-createReturnAdjustment()]] - code - backend/src/modules/cod/cod-records.service.ts
- [[dot-emitCodUpdated()]] - code - backend/src/modules/realtime/realtime.service.ts
- [[dot-exportRecords()]] - code - backend/src/modules/cod/cod.controller.ts
- [[dot-exportRecordsPdf()]] - code - backend/src/modules/cod/cod.controller.ts
- [[dot-findById()]] - code - backend/src/modules/cod/cod-records.service.ts
- [[dot-findByOmsOrder()]] - code - backend/src/modules/cod/cod-records.service.ts
- [[dot-findOne()]] - code - backend/src/modules/cod/cod.controller.ts
- [[dot-generateForDeliveredOrder()]] - code - backend/src/modules/cod/cod-records.service.ts
- [[dot-list()_4]] - code - backend/src/modules/cod/cod.controller.ts
- [[dot-recordEvent()]] - code - backend/src/modules/cod/cod-records.service.ts
- [[dot-retry()]] - code - backend/src/modules/cod/cod.controller.ts
- [[dot-retryGeneration()]] - code - backend/src/modules/cod/cod-records.service.ts
- [[dot-setStatus()]] - code - backend/src/modules/cod/cod.controller.ts
- [[dot-setStatus()_1]] - code - backend/src/modules/cod/cod-records.service.ts
- [[dot-setStatusByScan()]] - code - backend/src/modules/cod/cod.controller.ts
- [[dot-setStatusByScan()_1]] - code - backend/src/modules/cod/cod-records.service.ts
- [[dot-syncReturnedStatusIfNeeded()]] - code - backend/src/modules/cod/cod-records.service.ts
- [[dot-voidForDeliveryRevert()]] - code - backend/src/modules/cod/cod-records.service.ts
- [[Body_1]] - code
- [[CodController]] - code - backend/src/modules/cod/cod.controller.ts
- [[Controller_3]] - code
- [[Get_1]] - code
- [[Header]] - code
- [[Param_2]] - code
- [[Patch]] - code
- [[Post_1]] - code
- [[Query_1]] - code
- [[Res_1]] - code
- [[codExportContentDisposition()]] - code - backend/src/modules/cod/cod-export.util.ts
- [[serialize()]] - code - backend/src/modules/cod/cod-records.service.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/CodController
SORT file.name ASC
```

## Connections to other communities
- 19 edges to [[_COMMUNITY_AuthPrincipal]]
- 14 edges to [[_COMMUNITY_CodRecordsService]]
- 10 edges to [[_COMMUNITY_withTenantRls]]
- 9 edges to [[_COMMUNITY_CurrentUser]]
- 9 edges to [[_COMMUNITY_dot-validateResourceOwnership]]
- 7 edges to [[_COMMUNITY_ListCodRecordsQueryDto]]
- 4 edges to [[_COMMUNITY_RealtimeService]]
- 4 edges to [[_COMMUNITY_cod-export.util.ts]]
- 3 edges to [[_COMMUNITY_outbound.service.ts]]
- 2 edges to [[_COMMUNITY_@nestjscommon]]
- 1 edge to [[_COMMUNITY_app.module.ts]]
- 1 edge to [[_COMMUNITY_EncryptionService]]
- 1 edge to [[_COMMUNITY_@prismaclient]]

## Top bridge nodes
- [[dot-generateForDeliveredOrder()]] - degree 10, connects to 6 communities
- [[dot-addManualAdjustment()]] - degree 9, connects to 6 communities
- [[dot-voidForDeliveryRevert()]] - degree 8, connects to 5 communities
- [[dot-exportRecords()]] - degree 10, connects to 4 communities
- [[dot-exportRecordsPdf()]] - degree 10, connects to 4 communities