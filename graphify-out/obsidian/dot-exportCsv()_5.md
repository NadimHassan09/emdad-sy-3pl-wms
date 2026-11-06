---
source_file: "backend/src/modules/outbound/outbound-orders-csv.service.ts"
type: "code"
community: "inbound-orders-csv.service.ts"
location: "L102"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/inbound-orders-csvservicets
---

# .exportCsv()

## Connections
- [[dot-exportOrders()_3]] - `calls` [INFERRED]
- [[dot-exportOrdersPost()_2]] - `calls` [INFERRED]
- [[dot-listForExport()_2]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[ListOutboundQueryDto]] - `references` [EXTRACTED]
- [[OutboundOrdersCsvService]] - `method` [EXTRACTED]
- [[adminHeaderLabels()]] - `calls` [EXTRACTED]
- [[adminOrderedColumnIds()]] - `calls` [EXTRACTED]
- [[exportProductNames()]] - `calls` [EXTRACTED]
- [[exportProductWeights()]] - `calls` [EXTRACTED]
- [[rowsToCsv()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/inbound-orders-csvservicets