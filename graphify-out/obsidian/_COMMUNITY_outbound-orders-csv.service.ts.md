---
type: community
cohesion: 0.11
members: 33
---

# outbound-orders-csv.service.ts

**Cohesion:** 0.11 - loosely connected
**Members:** 33 nodes

## Members
- [[dot-constructor()_28]] - code - backend/src/modules/outbound/outbound.controller.ts
- [[dot-constructor()_29]] - code - backend/src/modules/outbound/outbound-orders-csv.service.ts
- [[dot-executeImport()]] - code - backend/src/modules/outbound/outbound-orders-csv.service.ts
- [[dot-findByExternalReference()]] - code - backend/src/modules/outbound/outbound.service.ts
- [[dot-findProductsBySkus()]] - code - backend/src/modules/outbound/outbound.service.ts
- [[dot-getImportTemplate()]] - code - backend/src/modules/outbound/outbound-orders-csv.service.ts
- [[dot-getLegacyImportTemplate()]] - code - backend/src/modules/outbound/outbound-orders-csv.service.ts
- [[dot-parseAndGroup()]] - code - backend/src/modules/outbound/outbound-orders-csv.service.ts
- [[dot-validateGroups()]] - code - backend/src/modules/outbound/outbound-orders-csv.service.ts
- [[dot-validateImport()_1]] - code - backend/src/modules/outbound/outbound-orders-csv.service.ts
- [[Injectable_10]] - code
- [[OUTBOUND_EXPORT_MAX_ROWS]] - code - backend/src/modules/outbound/outbound-orders-csv.service.ts
- [[OUTBOUND_IMPORT_CSV_HEADERS]] - code - backend/src/modules/outbound/outbound-orders-csv.util.ts
- [[OUTBOUND_IMPORT_MAX_ORDERS]] - code - backend/src/modules/outbound/outbound-orders-csv.service.ts
- [[OUTBOUND_IMPORT_MAX_ROWS]] - code - backend/src/modules/outbound/outbound-orders-csv.service.ts
- [[OutboundImportCsvHeader]] - code - backend/src/modules/outbound/outbound-orders-csv.util.ts
- [[OutboundImportExecuteResult_1]] - code - backend/src/modules/outbound/outbound-orders-csv.service.ts
- [[OutboundImportRowError_1]] - code - backend/src/modules/outbound/outbound-orders-csv.service.ts
- [[OutboundImportValidateResult_1]] - code - backend/src/modules/outbound/outbound-orders-csv.service.ts
- [[OutboundOrdersCsvService]] - code - backend/src/modules/outbound/outbound-orders-csv.service.ts
- [[ParsedOrderGroup]] - code - backend/src/modules/outbound/outbound-orders-csv.service.ts
- [[RFC-4180]] - concept - backend/src/modules/outbound/outbound-orders-csv.util.ts
- [[cell()]] - code - backend/src/modules/outbound/outbound-orders-csv.util.ts
- [[csvEscape()_2]] - code - backend/src/modules/outbound/outbound-orders-csv.util.ts
- [[mapCsvHeaderRow()]] - code - backend/src/modules/outbound/outbound-orders-csv.util.ts
- [[normalizeHeader()]] - code - backend/src/modules/outbound/outbound-orders-csv.util.ts
- [[outbound-orders-csv.service.ts]] - code - backend/src/modules/outbound/outbound-orders-csv.service.ts
- [[outbound-orders-csv.util.ts]] - code - backend/src/modules/outbound/outbound-orders-csv.util.ts
- [[outbound-orders-csv.util.unit.spec.ts]] - code - backend/src/modules/outbound/outbound-orders-csv.util.unit.spec.ts
- [[outboundImportTemplateCsv()]] - code - backend/src/modules/outbound/outbound-orders-csv.util.ts
- [[parseCsv()_1]] - code - backend/src/modules/outbound/outbound-orders-csv.util.ts
- [[parseRequiresPacking()]] - code - backend/src/modules/outbound/outbound-orders-csv.util.ts
- [[rowsToCsv()]] - code - backend/src/modules/outbound/outbound-orders-csv.util.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/outbound-orders-csvservicets
SORT file.name ASC
```

## Connections to other communities
- 13 edges to [[_COMMUNITY_inbound-orders-csv.service.ts]]
- 11 edges to [[_COMMUNITY_oms-client-import.service.ts]]
- 9 edges to [[_COMMUNITY_withTenantRls]]
- 8 edges to [[_COMMUNITY_AuthPrincipal]]
- 3 edges to [[_COMMUNITY_@nestjscommon]]
- 3 edges to [[_COMMUNITY_outbound.service.ts]]
- 3 edges to [[_COMMUNITY_task-inventory-effects.service.ts]]
- 3 edges to [[_COMMUNITY_class-validator]]
- 2 edges to [[_COMMUNITY_app.module.ts]]
- 2 edges to [[_COMMUNITY_@prismaclient]]
- 1 edge to [[_COMMUNITY_ListOutboundQueryDto]]
- 1 edge to [[_COMMUNITY_CreateOutboundOrderDto]]
- 1 edge to [[_COMMUNITY_ClientPrincipal]]
- 1 edge to [[_COMMUNITY_dot-assertCompanyAccess]]
- 1 edge to [[_COMMUNITY_EmptyToUndefined]]
- 1 edge to [[_COMMUNITY_reliability-test-helpers.ts]]

## Top bridge nodes
- [[outbound-orders-csv.service.ts]] - degree 49, connects to 14 communities
- [[OutboundOrdersCsvService]] - degree 16, connects to 5 communities
- [[dot-findByExternalReference()]] - degree 7, connects to 5 communities
- [[dot-validateGroups()]] - degree 12, connects to 4 communities
- [[dot-constructor()_28]] - degree 5, connects to 3 communities