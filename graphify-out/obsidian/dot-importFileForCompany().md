---
source_file: "backend/src/modules/client-portal/order-import/inbound-client-import.service.ts"
type: "code"
community: "oms-client-import.service.ts"
location: "L51"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/oms-client-importservicets
---

# .importFileForCompany()

## Connections
- [[dot-create()_42]] - `calls` [INFERRED]
- [[dot-findByExternalReference()_1]] - `calls` [INFERRED]
- [[dot-findProductsBySkus()_1]] - `calls` [INFERRED]
- [[dot-importFile()]] - `calls` [EXTRACTED]
- [[dot-importOrders()]] - `calls` [INFERRED]
- [[dot-resolveImportCompanyId()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[ClientOrderImportSummary_1]] - `references` [EXTRACTED]
- [[InboundClientImportService]] - `method` [EXTRACTED]
- [[assertDiscreteUomPositiveIntegerQuantity()]] - `calls` [EXTRACTED]
- [[assertImportTable()]] - `calls` [EXTRACTED]
- [[calendarTodayYmdServerLocal()]] - `calls` [EXTRACTED]
- [[groupRowsByOrderNumber()]] - `calls` [EXTRACTED]
- [[parseImportMdYDate()]] - `calls` [EXTRACTED]
- [[parseSpreadsheetTable()]] - `calls` [EXTRACTED]
- [[validateImportOrderNumber()]] - `calls` [EXTRACTED]
- [[validateImportPositiveQuantity()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/oms-client-importservicets