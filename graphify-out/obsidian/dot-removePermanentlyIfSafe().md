---
source_file: "backend/src/modules/products/products.service.ts"
type: "code"
community: "product-delete-references.util.ts"
location: "L672"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/product-delete-referencesutilts
---

# .removePermanentlyIfSafe()

## Connections
- [[dot-emitProductDeleted()]] - `calls` [INFERRED]
- [[dot-findById()_2]] - `calls` [EXTRACTED]
- [[dot-hardDelete()]] - `calls` [INFERRED]
- [[dot-remove()_7]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[ProductsService]] - `method` [EXTRACTED]
- [[inboundLinesBlockingProductDeleteWhere()]] - `calls` [EXTRACTED]
- [[omsLinesBlockingProductDeleteWhere()]] - `calls` [EXTRACTED]
- [[outboundLinesBlockingProductDeleteWhere()]] - `calls` [EXTRACTED]
- [[purgeRemovableOrderLinesForProduct()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/product-delete-referencesutilts