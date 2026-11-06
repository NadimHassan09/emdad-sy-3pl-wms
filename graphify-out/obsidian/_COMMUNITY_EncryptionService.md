---
type: community
cohesion: 0.09
members: 35
---

# EncryptionService

**Cohesion:** 0.09 - loosely connected
**Members:** 35 nodes

## Members
- [[dot-cancelUnconfirmedDraftReturns()]] - code - backend/src/modules/shipping/shipping-auto-return.service.ts
- [[dot-confirmWarehouseReturnReceipt()]] - code - backend/src/modules/shipping/shipping-auto-return.service.ts
- [[dot-confirmWarehouseReturnReceiptForOrder()]] - code - backend/src/modules/shipping/shipping-auto-return.service.ts
- [[dot-constructor()_12]] - code - backend/src/common/crypto/encryption.service.ts
- [[dot-constructor()_13]] - code - backend/src/modules/shipping/providers/babel-express/babel-address.adapter.ts
- [[dot-constructor()_14]] - code - backend/src/modules/shipping/shipping.controller.ts
- [[dot-constructor()_15]] - code - backend/src/modules/shipping/shipping-provider.registry.ts
- [[dot-constructor()_16]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-constructor()_17]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[dot-emitOmsOrderEvent()]] - code - backend/src/modules/realtime/realtime.service.ts
- [[dot-emitOmsReturnEvent()]] - code - backend/src/modules/realtime/realtime.service.ts
- [[dot-encrypt()]] - code - backend/src/common/crypto/encryption.service.ts
- [[dot-handleCarrierDeliveredEvent()]] - code - backend/src/modules/shipping/shipping-auto-return.service.ts
- [[dot-isBabelCovered()]] - code - backend/src/modules/shipping/providers/babel-express/babel-address.adapter.ts
- [[dot-listCodes()]] - code - backend/src/modules/shipping/shipping-provider.registry.ts
- [[dot-processAutomatedReturn()]] - code - backend/src/modules/shipping/shipping-auto-return.service.ts
- [[dot-processCarrierReturnEvent()]] - code - backend/src/modules/shipping/shipping-auto-return.service.ts
- [[dot-promoteOrderToReturnPendingReceipt()]] - code - backend/src/modules/shipping/shipping-auto-return.service.ts
- [[dot-resolveFromSnapshot()]] - code - backend/src/modules/shipping/providers/babel-express/babel-address.adapter.ts
- [[dot-resolveKey()]] - code - backend/src/common/crypto/encryption.service.ts
- [[dot-resolveNeighbourhoodId()]] - code - backend/src/modules/shipping/providers/babel-express/babel-address.adapter.ts
- [[dot-validateNeighbourhoodId()]] - code - backend/src/modules/shipping/providers/babel-express/babel-address.adapter.ts
- [[BabelAddressAdapter]] - code - backend/src/modules/shipping/providers/babel-express/babel-address.adapter.ts
- [[BabelAddressIndex]] - code - backend/src/modules/shipping/providers/babel-express/babel-address.adapter.ts
- [[EncryptionService]] - code - backend/src/common/crypto/encryption.service.ts
- [[Injectable_2]] - code
- [[Injectable_3]] - code
- [[Injectable_4]] - code
- [[Injectable_5]] - code
- [[ShippingAutoReturnService]] - code - backend/src/modules/shipping/shipping-auto-return.service.ts
- [[ShippingProviderRegistry]] - code - backend/src/modules/shipping/shipping-provider.registry.ts
- [[babel-address.adapter.ts]] - code - backend/src/modules/shipping/providers/babel-express/babel-address.adapter.ts
- [[babel-address.adapter.unit.spec.ts]] - code - backend/src/modules/shipping/providers/babel-express/babel-address.adapter.unit.spec.ts
- [[backend_src_data_syria_locations_babel_address_index]] - concept
- [[lookupBabelNeighbourhoodIdFromIndex()]] - code - backend/src/modules/shipping/providers/babel-express/babel-address.adapter.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/EncryptionService
SORT file.name ASC
```

## Connections to other communities
- 14 edges to [[_COMMUNITY_shipping.service.ts]]
- 13 edges to [[_COMMUNITY_shipping-tracking.service.ts]]
- 11 edges to [[_COMMUNITY_RealtimeService]]
- 9 edges to [[_COMMUNITY_shipping.module.ts]]
- 8 edges to [[_COMMUNITY_@prismaclient]]
- 8 edges to [[_COMMUNITY_withTenantRls]]
- 6 edges to [[_COMMUNITY_shipping.controller.ts]]
- 5 edges to [[_COMMUNITY_babel-express.adapter.ts]]
- 4 edges to [[_COMMUNITY_ShippingController]]
- 4 edges to [[_COMMUNITY_task-inventory-effects.service.ts]]
- 4 edges to [[_COMMUNITY_CodRecordsService]]
- 3 edges to [[_COMMUNITY_AuthPrincipal]]
- 3 edges to [[_COMMUNITY_dot-validateResourceOwnership]]
- 2 edges to [[_COMMUNITY_shipping-fx.service.ts]]
- 2 edges to [[_COMMUNITY_shipping-preflight.ts]]
- 2 edges to [[_COMMUNITY_@nestjscommon]]
- 1 edge to [[_COMMUNITY_bulk-shipping.service.ts]]
- 1 edge to [[_COMMUNITY_sila-webhook.util.ts]]
- 1 edge to [[_COMMUNITY_client-oms-orders.service.ts]]
- 1 edge to [[_COMMUNITY_sila-sy.adapter.ts]]
- 1 edge to [[_COMMUNITY_outbound.service.ts]]
- 1 edge to [[_COMMUNITY_shipping-fee.service.ts]]
- 1 edge to [[_COMMUNITY_CodController]]

## Top bridge nodes
- [[ShippingProviderRegistry]] - degree 20, connects to 9 communities
- [[dot-constructor()_14]] - degree 12, connects to 8 communities
- [[EncryptionService]] - degree 20, connects to 7 communities
- [[ShippingAutoReturnService]] - degree 17, connects to 6 communities
- [[dot-constructor()_16]] - degree 9, connects to 6 communities