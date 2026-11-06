---
source_file: "backend/src/modules/oms/oms-orders-csv.service.ts"
type: "code"
community: "inbound-orders-csv.service.ts"
location: "L186"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/inbound-orders-csvservicets
---

# .exportXlsx()

## Connections
- [[dot-exportOrdersPost()_1]] - `calls` [INFERRED]
- [[dot-listForExport()_5]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[ListOmsOrdersQueryDto]] - `references` [EXTRACTED]
- [[OmsOrdersCsvService]] - `method` [EXTRACTED]
- [[adminHeaderLabels()]] - `calls` [EXTRACTED]
- [[adminOrderedColumnIds()]] - `calls` [EXTRACTED]
- [[buildExcelBuffer()]] - `calls` [EXTRACTED]
- [[exportProductNames()]] - `calls` [EXTRACTED]
- [[exportProductWeights()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/inbound-orders-csvservicets