---
source_file: "backend/src/modules/client-portal/order-import/oms-client-import.service.ts"
type: "code"
community: "oms-client-import.service.ts"
location: "L63"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/oms-client-importservicets
---

# .importFileForCompany()

## Connections
- [[dot-assertBillingAllowed()]] - `calls` [INFERRED]
- [[dot-create()_44]] - `calls` [INFERRED]
- [[dot-findExistingByExternalReference()]] - `calls` [INFERRED]
- [[dot-findProductsBySkus()_2]] - `calls` [INFERRED]
- [[dot-importFile()_2]] - `calls` [EXTRACTED]
- [[dot-importOrders()_1]] - `calls` [INFERRED]
- [[dot-resolveImportCompanyId()_1]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[ClientOrderImportSummary_1]] - `references` [EXTRACTED]
- [[OmsClientImportService]] - `method` [EXTRACTED]
- [[assertDiscreteUomPositiveIntegerQuantity()]] - `calls` [EXTRACTED]
- [[assertImportTable()]] - `calls` [EXTRACTED]
- [[calendarTodayYmdServerLocal()]] - `calls` [EXTRACTED]
- [[groupRowsByOrderNumber()]] - `calls` [EXTRACTED]
- [[parseImportShipDateMdY()]] - `calls` [EXTRACTED]
- [[parseSpreadsheetTable()]] - `calls` [EXTRACTED]
- [[resolveOmsDeliveryLocation()]] - `calls` [EXTRACTED]
- [[validateImportAsciiNonNegativeInt()]] - `calls` [EXTRACTED]
- [[validateImportCountryCode()]] - `calls` [EXTRACTED]
- [[validateImportOrderNumber()]] - `calls` [EXTRACTED]
- [[validateImportPaymentMethod()]] - `calls` [EXTRACTED]
- [[validateImportPositiveQuantity()]] - `calls` [EXTRACTED]
- [[validateImportRecipientName()]] - `calls` [EXTRACTED]
- [[validateImportRecipientPhone()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/oms-client-importservicets