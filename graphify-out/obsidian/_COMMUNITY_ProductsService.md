---
type: community
cohesion: 0.19
members: 24
---

# ProductsService

**Cohesion:** 0.19 - loosely connected
**Members:** 24 nodes

## Members
- [[dot-allocateUniqueBarcode()]] - code - backend/src/modules/products/products.service.ts
- [[dot-constructor()_57]] - code - backend/src/modules/products/products.controller.ts
- [[dot-create()_5]] - code - backend/src/modules/products/products.service.ts
- [[dot-emitProductUpdated()]] - code - backend/src/modules/realtime/realtime.service.ts
- [[dot-exportXlsx()_6]] - code - backend/src/modules/products/products.service.ts
- [[dot-findById()_2]] - code - backend/src/modules/products/products.service.ts
- [[dot-listLotsForProduct()]] - code - backend/src/modules/products/products.service.ts
- [[dot-softDelete()]] - code - backend/src/modules/products/products.service.ts
- [[dot-suspend()_2]] - code - backend/src/modules/products/products.service.ts
- [[dot-throwUniqueViolation()]] - code - backend/src/modules/products/products.service.ts
- [[dot-unsuspend()]] - code - backend/src/modules/products/products.service.ts
- [[dot-update()_2]] - code - backend/src/modules/products/products.service.ts
- [[dot-withProductCatalogRls()]] - code - backend/src/modules/products/products.service.ts
- [[BARCODE_BLOCKING_STATUSES]] - code - backend/src/modules/products/product-barcode.util.ts
- [[BarcodeLookupDb]] - code - backend/src/modules/products/product-barcode.util.ts
- [[Injectable_30]] - code
- [[ProductsService]] - code - backend/src/modules/products/products.service.ts
- [[assertCompanyBarcodeAvailable()]] - code - backend/src/modules/products/product-barcode.util.ts
- [[barcodeChanged()]] - code - backend/src/modules/products/product-barcode.util.ts
- [[normalizeProductBarcode()]] - code - backend/src/modules/products/product-barcode.util.ts
- [[product-barcode.util.ts]] - code - backend/src/modules/products/product-barcode.util.ts
- [[product-barcode.util.unit.spec.ts]] - code - backend/src/modules/products/product-barcode.util.unit.spec.ts
- [[productAuditSnapshot()]] - code - backend/src/modules/products/product-audit.util.ts
- [[productRealtimePayload()]] - code - backend/src/modules/realtime/realtime-master-data.payload.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/ProductsService
SORT file.name ASC
```

## Connections to other communities
- 20 edges to [[_COMMUNITY_AuditLogService]]
- 9 edges to [[_COMMUNITY_ProductsController]]
- 9 edges to [[_COMMUNITY_AuthPrincipal]]
- 7 edges to [[_COMMUNITY_testProductUpdateAuditHasBeforeAfter]]
- 6 edges to [[_COMMUNITY_RealtimeService]]
- 6 edges to [[_COMMUNITY_dot-fromPrincipal]]
- 4 edges to [[_COMMUNITY_@nestjscommon]]
- 4 edges to [[_COMMUNITY_product-delete-references.util.ts]]
- 3 edges to [[_COMMUNITY_ClientPrincipal]]
- 2 edges to [[_COMMUNITY_withTenantRls]]
- 2 edges to [[_COMMUNITY_@prismaclient]]
- 1 edge to [[_COMMUNITY_app.module.ts]]
- 1 edge to [[_COMMUNITY_inventory.service.ts]]
- 1 edge to [[_COMMUNITY_task-inventory-effects.service.ts]]
- 1 edge to [[_COMMUNITY_CreateProductDto]]
- 1 edge to [[_COMMUNITY_UpdateProductDto]]
- 1 edge to [[_COMMUNITY_EmptyToUndefined]]
- 1 edge to [[_COMMUNITY_inbound-orders-csv.service.ts]]
- 1 edge to [[_COMMUNITY_dot-validateResourceOwnership]]

## Top bridge nodes
- [[dot-create()_5]] - degree 22, connects to 9 communities
- [[ProductsService]] - degree 30, connects to 7 communities
- [[dot-update()_2]] - degree 17, connects to 7 communities
- [[dot-exportXlsx()_6]] - degree 8, connects to 6 communities
- [[dot-findById()_2]] - degree 11, connects to 5 communities