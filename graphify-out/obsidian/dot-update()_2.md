---
source_file: "backend/src/modules/products/products.service.ts"
type: "code"
community: "ProductsService"
location: "L473"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/ProductsService
---

# .update()

## Connections
- [[dot-emitProductUpdated()]] - `calls` [INFERRED]
- [[dot-findById()_2]] - `calls` [EXTRACTED]
- [[dot-fromPrincipal()]] - `calls` [INFERRED]
- [[dot-log()]] - `calls` [INFERRED]
- [[dot-throwUniqueViolation()]] - `calls` [EXTRACTED]
- [[dot-update()_8]] - `calls` [INFERRED]
- [[dot-update()_3]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[ProductsService]] - `method` [EXTRACTED]
- [[UpdateProductDto]] - `references` [EXTRACTED]
- [[assertCompanyBarcodeAvailable()]] - `calls` [EXTRACTED]
- [[barcodeChanged()]] - `calls` [EXTRACTED]
- [[normalizeProductBarcode()]] - `calls` [EXTRACTED]
- [[productAuditSnapshot()]] - `calls` [EXTRACTED]
- [[productRealtimePayload()]] - `calls` [EXTRACTED]
- [[resolveProductVolumeCbmFromDims()]] - `calls` [EXTRACTED]
- [[testProductUpdateAuditHasBeforeAfter()]] - `calls` [INFERRED]

#graphify/code #graphify/EXTRACTED #community/ProductsService