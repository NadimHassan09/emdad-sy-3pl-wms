---
source_file: "backend/src/modules/outbound/outbound-orders-csv.service.ts"
type: "code"
community: "inbound-orders-csv.service.ts"
location: "L163"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/inbound-orders-csvservicets
---

# .exportXlsx()

## Connections
- [[dot-exportOrdersPost()_2]] - `calls` [INFERRED]
- [[dot-listForExport()_2]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[ListOutboundQueryDto]] - `references` [EXTRACTED]
- [[OutboundOrdersCsvService]] - `method` [EXTRACTED]
- [[adminHeaderLabels()]] - `calls` [EXTRACTED]
- [[adminOrderedColumnIds()]] - `calls` [EXTRACTED]
- [[buildExcelBuffer()]] - `calls` [EXTRACTED]
- [[exportProductNames()]] - `calls` [EXTRACTED]
- [[exportProductWeights()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/inbound-orders-csvservicets