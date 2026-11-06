---
type: community
cohesion: 0.23
members: 14
---

# product-delete-references.util.ts

**Cohesion:** 0.23 - loosely connected
**Members:** 14 nodes

## Members
- [[dot-list()_15]] - code - backend/src/modules/products/products.service.ts
- [[dot-removePermanentlyIfSafe()]] - code - backend/src/modules/products/products.service.ts
- [[INBOUND_ORDER_STATUSES_BLOCKING_PRODUCT_DELETE]] - code - backend/src/modules/products/product-delete-references.util.ts
- [[INBOUND_ORDER_STATUSES_REMOVABLE_PRODUCT_LINES]] - code - backend/src/modules/products/product-delete-references.util.ts
- [[OMS_ORDER_STATUSES_BLOCKING_PRODUCT_DELETE]] - code - backend/src/modules/products/product-delete-references.util.ts
- [[OMS_ORDER_STATUSES_REMOVABLE_PRODUCT_LINES]] - code - backend/src/modules/products/product-delete-references.util.ts
- [[OUTBOUND_ORDER_STATUSES_BLOCKING_PRODUCT_DELETE]] - code - backend/src/modules/products/product-delete-references.util.ts
- [[OUTBOUND_ORDER_STATUSES_REMOVABLE_PRODUCT_LINES]] - code - backend/src/modules/products/product-delete-references.util.ts
- [[inboundLinesBlockingProductDeleteWhere()]] - code - backend/src/modules/products/product-delete-references.util.ts
- [[omsLinesBlockingProductDeleteWhere()]] - code - backend/src/modules/products/product-delete-references.util.ts
- [[outboundLinesBlockingProductDeleteWhere()]] - code - backend/src/modules/products/product-delete-references.util.ts
- [[product-delete-references.util.ts]] - code - backend/src/modules/products/product-delete-references.util.ts
- [[productIdFilter()]] - code - backend/src/modules/products/product-delete-references.util.ts
- [[purgeRemovableOrderLinesForProduct()]] - code - backend/src/modules/products/product-delete-references.util.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/product-delete-referencesutilts
SORT file.name ASC
```

## Connections to other communities
- 6 edges to [[_COMMUNITY_AuditLogService]]
- 4 edges to [[_COMMUNITY_ProductsService]]
- 3 edges to [[_COMMUNITY_@prismaclient]]
- 2 edges to [[_COMMUNITY_AuthPrincipal]]
- 2 edges to [[_COMMUNITY_ProductsController]]
- 2 edges to [[_COMMUNITY_ClientPrincipal]]
- 1 edge to [[_COMMUNITY_EmptyToUndefined]]
- 1 edge to [[_COMMUNITY_RealtimeService]]

## Top bridge nodes
- [[dot-list()_15]] - degree 12, connects to 7 communities
- [[dot-removePermanentlyIfSafe()]] - degree 10, connects to 5 communities
- [[product-delete-references.util.ts]] - degree 13, connects to 2 communities
- [[inboundLinesBlockingProductDeleteWhere()]] - degree 5, connects to 1 community
- [[omsLinesBlockingProductDeleteWhere()]] - degree 5, connects to 1 community