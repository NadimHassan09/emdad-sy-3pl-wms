---
source_file: "backend/src/modules/products/products.service.ts"
type: "code"
community: "ProductsService"
location: "L101"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/ProductsService
---

# .create()

## Connections
- [[dot-allocateUniqueBarcode()]] - `calls` [EXTRACTED]
- [[dot-assertOperationalBilling()]] - `calls` [INFERRED]
- [[dot-create()_36]] - `calls` [INFERRED]
- [[dot-create()_7]] - `calls` [INFERRED]
- [[dot-emitProductCreated()]] - `calls` [INFERRED]
- [[dot-fromPrincipal()]] - `calls` [INFERRED]
- [[dot-log()]] - `calls` [INFERRED]
- [[dot-resolveWriteCompanyId()]] - `calls` [INFERRED]
- [[dot-throwUniqueViolation()]] - `calls` [EXTRACTED]
- [[dot-withProductCatalogRls()]] - `calls` [EXTRACTED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[CreateProductDto]] - `references` [EXTRACTED]
- [[ProductsService]] - `method` [EXTRACTED]
- [[assertCompanyBarcodeAvailable()]] - `calls` [EXTRACTED]
- [[generateSkuCandidate()]] - `calls` [EXTRACTED]
- [[normalizeProductBarcode()]] - `calls` [EXTRACTED]
- [[productAuditSnapshot()]] - `calls` [EXTRACTED]
- [[productRealtimePayload()]] - `calls` [EXTRACTED]
- [[resolveProductVolumeCbmFromDims()]] - `calls` [EXTRACTED]
- [[testNoDuplicateAuditOnRetry()]] - `calls` [INFERRED]
- [[testProductCreateAudit()]] - `calls` [INFERRED]
- [[testProductUpdateAuditHasBeforeAfter()]] - `calls` [INFERRED]

#graphify/code #graphify/EXTRACTED #community/ProductsService