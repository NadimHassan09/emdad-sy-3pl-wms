# product-delete-references.util.ts

> 14 nodes · cohesion 0.23

## Key Concepts

- **product-delete-references.util.ts** (13 connections) — `backend/src/modules/products/product-delete-references.util.ts`
- **.list()** (12 connections) — `backend/src/modules/products/products.service.ts`
- **.removePermanentlyIfSafe()** (10 connections) — `backend/src/modules/products/products.service.ts`
- **inboundLinesBlockingProductDeleteWhere()** (5 connections) — `backend/src/modules/products/product-delete-references.util.ts`
- **omsLinesBlockingProductDeleteWhere()** (5 connections) — `backend/src/modules/products/product-delete-references.util.ts`
- **outboundLinesBlockingProductDeleteWhere()** (5 connections) — `backend/src/modules/products/product-delete-references.util.ts`
- **productIdFilter()** (4 connections) — `backend/src/modules/products/product-delete-references.util.ts`
- **purgeRemovableOrderLinesForProduct()** (3 connections) — `backend/src/modules/products/product-delete-references.util.ts`
- **INBOUND_ORDER_STATUSES_BLOCKING_PRODUCT_DELETE** (1 connections) — `backend/src/modules/products/product-delete-references.util.ts`
- **INBOUND_ORDER_STATUSES_REMOVABLE_PRODUCT_LINES** (1 connections) — `backend/src/modules/products/product-delete-references.util.ts`
- **OMS_ORDER_STATUSES_BLOCKING_PRODUCT_DELETE** (1 connections) — `backend/src/modules/products/product-delete-references.util.ts`
- **OMS_ORDER_STATUSES_REMOVABLE_PRODUCT_LINES** (1 connections) — `backend/src/modules/products/product-delete-references.util.ts`
- **OUTBOUND_ORDER_STATUSES_BLOCKING_PRODUCT_DELETE** (1 connections) — `backend/src/modules/products/product-delete-references.util.ts`
- **OUTBOUND_ORDER_STATUSES_REMOVABLE_PRODUCT_LINES** (1 connections) — `backend/src/modules/products/product-delete-references.util.ts`

## Relationships

- [AuditLogService](AuditLogService.md) (6 shared connections)
- [ProductsService](ProductsService.md) (4 shared connections)
- [@prisma/client](@prisma-client.md) (3 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (2 shared connections)
- [ClientPrincipal](ClientPrincipal.md) (2 shared connections)
- [ProductsController](ProductsController.md) (2 shared connections)
- [EmptyToUndefined](EmptyToUndefined.md) (1 shared connections)
- [RealtimeService](RealtimeService.md) (1 shared connections)

## Source Files

- `backend/src/modules/products/product-delete-references.util.ts`
- `backend/src/modules/products/products.service.ts`

## Audit Trail

- EXTRACTED: 37 (88%)
- INFERRED: 5 (12%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*