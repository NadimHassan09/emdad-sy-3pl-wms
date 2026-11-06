---
source_file: "backend/src/modules/oms/order-export-product-cells.ts"
type: "code"
community: "inbound-orders-csv.service.ts"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/inbound-orders-csvservicets
---

# order-export-product-cells.ts

## Connections
- [[EXPORT_PRODUCT_SELECT]] - `contains` [EXTRACTED]
- [[ExportLine]] - `contains` [EXTRACTED]
- [[LineProduct]] - `contains` [EXTRACTED]
- [[asLines()]] - `contains` [EXTRACTED]
- [[client-inbound-export.service.ts]] - `imports_from` [EXTRACTED]
- [[client-oms-export.service.ts]] - `imports_from` [EXTRACTED]
- [[client-outbound-export.service.ts]] - `imports_from` [EXTRACTED]
- [[exportProductNames()]] - `contains` [EXTRACTED]
- [[exportProductWeights()]] - `contains` [EXTRACTED]
- [[inbound-orders-csv.service.ts]] - `imports_from` [EXTRACTED]
- [[oms-orders-csv.service.ts]] - `imports_from` [EXTRACTED]
- [[order-export-product-cells.unit.spec.ts]] - `imports_from` [EXTRACTED]
- [[outbound-orders-csv.service.ts]] - `imports_from` [EXTRACTED]
- [[productName()]] - `contains` [EXTRACTED]
- [[productWeight()]] - `contains` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/inbound-orders-csvservicets