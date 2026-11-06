# ProductsService

> 24 nodes · cohesion 0.19

## Key Concepts

- **ProductsService** (30 connections) — `backend/src/modules/products/products.service.ts`
- **.create()** (22 connections) — `backend/src/modules/products/products.service.ts`
- **.update()** (17 connections) — `backend/src/modules/products/products.service.ts`
- **.findById()** (11 connections) — `backend/src/modules/products/products.service.ts`
- **product-barcode.util.ts** (9 connections) — `backend/src/modules/products/product-barcode.util.ts`
- **assertCompanyBarcodeAvailable()** (8 connections) — `backend/src/modules/products/product-barcode.util.ts`
- **.exportXlsx()** (8 connections) — `backend/src/modules/products/products.service.ts`
- **.softDelete()** (8 connections) — `backend/src/modules/products/products.service.ts`
- **.unsuspend()** (8 connections) — `backend/src/modules/products/products.service.ts`
- **normalizeProductBarcode()** (7 connections) — `backend/src/modules/products/product-barcode.util.ts`
- **.emitProductUpdated()** (7 connections) — `backend/src/modules/realtime/realtime.service.ts`
- **.suspend()** (6 connections) — `backend/src/modules/products/products.service.ts`
- **productRealtimePayload()** (6 connections) — `backend/src/modules/realtime/realtime-master-data.payload.ts`
- **productAuditSnapshot()** (5 connections) — `backend/src/modules/products/product-audit.util.ts`
- **barcodeChanged()** (5 connections) — `backend/src/modules/products/product-barcode.util.ts`
- **product-barcode.util.unit.spec.ts** (5 connections) — `backend/src/modules/products/product-barcode.util.unit.spec.ts`
- **.withProductCatalogRls()** (5 connections) — `backend/src/modules/products/products.service.ts`
- **.allocateUniqueBarcode()** (4 connections) — `backend/src/modules/products/products.service.ts`
- **.listLotsForProduct()** (4 connections) — `backend/src/modules/products/products.service.ts`
- **.throwUniqueViolation()** (4 connections) — `backend/src/modules/products/products.service.ts`
- **.constructor()** (2 connections) — `backend/src/modules/products/products.controller.ts`
- **BARCODE_BLOCKING_STATUSES** (1 connections) — `backend/src/modules/products/product-barcode.util.ts`
- **BarcodeLookupDb** (1 connections) — `backend/src/modules/products/product-barcode.util.ts`
- **Injectable** (1 connections)

## Relationships

- [AuditLogService](AuditLogService.md) (20 shared connections)
- [ProductsController](ProductsController.md) (9 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (9 shared connections)
- [testProductUpdateAuditHasBeforeAfter](testProductUpdateAuditHasBeforeAfter.md) (7 shared connections)
- [.fromPrincipal](fromPrincipal.md) (6 shared connections)
- [RealtimeService](RealtimeService.md) (6 shared connections)
- [@nestjs/common](@nestjs-common.md) (4 shared connections)
- [product-delete-references.util.ts](product-delete-references.util.ts.md) (4 shared connections)
- [ClientPrincipal](ClientPrincipal.md) (3 shared connections)
- [@prisma/client](@prisma-client.md) (2 shared connections)
- [withTenantRls](withTenantRls.md) (2 shared connections)
- [app.module.ts](app.module.ts.md) (1 shared connections)

## Source Files

- `backend/src/modules/products/product-audit.util.ts`
- `backend/src/modules/products/product-barcode.util.ts`
- `backend/src/modules/products/product-barcode.util.unit.spec.ts`
- `backend/src/modules/products/products.controller.ts`
- `backend/src/modules/products/products.service.ts`
- `backend/src/modules/realtime/realtime-master-data.payload.ts`
- `backend/src/modules/realtime/realtime.service.ts`

## Audit Trail

- EXTRACTED: 103 (78%)
- INFERRED: 29 (22%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*