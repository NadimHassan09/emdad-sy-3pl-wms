---
source_file: "backend/src/modules/oms/oms-orders.service.ts"
type: "code"
community: "withTenantRls"
location: "L353"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/withTenantRls
---

# .listForExport()

## Connections
- [[dot-buildListWhere()_5]] - `calls` [EXTRACTED]
- [[dot-exportCsv()_4]] - `calls` [INFERRED]
- [[dot-exportXlsx()_4]] - `calls` [INFERRED]
- [[dot-listForExport()_3]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[ListOmsOrdersQueryDto]] - `references` [EXTRACTED]
- [[OmsOrdersService]] - `method` [EXTRACTED]
- [[serializeOmsOrder()]] - `indirect_call` [INFERRED]
- [[withTenantRls()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/withTenantRls