---
source_file: "backend/src/modules/client-portal/order-import/outbound-client-import.service.ts"
type: "code"
community: "oms-client-import.service.ts"
location: "L49"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/oms-client-importservicets
---

# .importFileForCompany()

## Connections
- [[dot-create()_45]] - `calls` [INFERRED]
- [[dot-findByExternalReference()]] - `calls` [INFERRED]
- [[dot-findProductsBySkus()]] - `calls` [INFERRED]
- [[dot-importFile()_1]] - `calls` [EXTRACTED]
- [[dot-importOrders()_3]] - `calls` [INFERRED]
- [[dot-resolveImportCompanyId()_2]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[ClientOrderImportSummary_1]] - `references` [EXTRACTED]
- [[OutboundClientImportService]] - `method` [EXTRACTED]
- [[assertDiscreteUomPositiveIntegerQuantity()]] - `calls` [EXTRACTED]
- [[assertImportTable()]] - `calls` [EXTRACTED]
- [[calendarTodayYmdServerLocal()]] - `calls` [EXTRACTED]
- [[groupRowsByOrderNumber()]] - `calls` [EXTRACTED]
- [[parseFlexibleDate()]] - `calls` [EXTRACTED]
- [[parseSpreadsheetTable()]] - `calls` [EXTRACTED]
- [[validateImportOrderNumber()]] - `calls` [EXTRACTED]
- [[validateImportPositiveQuantity()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/oms-client-importservicets