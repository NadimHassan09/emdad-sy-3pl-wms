---
source_file: "backend/src/modules/inbound/inbound-orders-csv.service.ts"
type: "code"
community: "inbound-orders-csv.service.ts"
location: "L165"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/inbound-orders-csvservicets
---

# .exportXlsx()

## Connections
- [[dot-exportOrdersPost()]] - `calls` [INFERRED]
- [[dot-listForExport()_1]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[InboundOrdersCsvService]] - `method` [EXTRACTED]
- [[ListInboundQueryDto]] - `references` [EXTRACTED]
- [[adminHeaderLabels()]] - `calls` [EXTRACTED]
- [[adminOrderedColumnIds()]] - `calls` [EXTRACTED]
- [[buildExcelBuffer()]] - `calls` [EXTRACTED]
- [[exportProductNames()]] - `calls` [EXTRACTED]
- [[exportProductWeights()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/inbound-orders-csvservicets