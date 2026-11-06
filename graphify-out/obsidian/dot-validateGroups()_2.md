---
source_file: "backend/src/modules/oms/oms-orders-csv.service.ts"
type: "code"
community: "withTenantRls"
location: "L413"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/withTenantRls
---

# .validateGroups()

## Connections
- [[dot-assertImportCreateReady()_1]] - `calls` [INFERRED]
- [[dot-executeImport()_2]] - `calls` [EXTRACTED]
- [[dot-findExistingByExternalReference()]] - `calls` [INFERRED]
- [[dot-findProductsBySkus()_2]] - `calls` [INFERRED]
- [[dot-resolveImportCompanyId()_1]] - `calls` [INFERRED]
- [[dot-validateImport()_4]] - `calls` [EXTRACTED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[OmsOrdersCsvService]] - `method` [EXTRACTED]
- [[assertDiscreteUomPositiveIntegerQuantity()]] - `calls` [EXTRACTED]
- [[parseImportShipDateMdY()]] - `calls` [EXTRACTED]
- [[validateImportOrderNumber()]] - `calls` [EXTRACTED]
- [[validateImportPaymentMethod()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/withTenantRls