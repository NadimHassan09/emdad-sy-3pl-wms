---
type: community
cohesion: 0.06
members: 82
---

# shipping.module.ts

**Cohesion:** 0.06 - loosely connected
**Members:** 82 nodes

## Members
- [[dot-cancelShipment()_3]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.adapter.ts
- [[dot-constructor()_171]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.adapter.ts
- [[dot-constructor()_172]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.http-client.ts
- [[dot-createShipment()_2]] - code - backend/src/modules/shipping/providers/mock-carrier/mock-carrier.adapter.ts
- [[dot-createShipment()_3]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.adapter.ts
- [[dot-findShipmentByReference()_2]] - code - backend/src/modules/shipping/providers/mock-carrier/mock-carrier.adapter.ts
- [[dot-findShipmentByReference()_3]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.adapter.ts
- [[dot-get()_5]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.http-client.ts
- [[dot-getDeliveryZones()]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.adapter.ts
- [[dot-getPickupAddresses()]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.adapter.ts
- [[dot-getQuote()_2]] - code - backend/src/modules/shipping/providers/mock-carrier/mock-carrier.adapter.ts
- [[dot-getServiceOptions()_2]] - code - backend/src/modules/shipping/providers/mock-carrier/mock-carrier.adapter.ts
- [[dot-getShipment()]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.adapter.ts
- [[dot-getShipmentStatuses()]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.adapter.ts
- [[dot-getStockItems()]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.adapter.ts
- [[dot-getTrackingHistory()_2]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.adapter.ts
- [[dot-listShipments()]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.adapter.ts
- [[dot-normalizeWebhook()_2]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.adapter.ts
- [[dot-pollTracking()_3]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.adapter.ts
- [[dot-post()_1]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.http-client.ts
- [[dot-request()_1]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.http-client.ts
- [[dot-testConnection()_2]] - code - backend/src/modules/shipping/providers/mock-carrier/mock-carrier.adapter.ts
- [[dot-testConnection()_3]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.adapter.ts
- [[dot-verifyWebhook()_2]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.adapter.ts
- [[Injectable_111]] - code
- [[Injectable_112]] - code
- [[Injectable_113]] - code
- [[MOCK_CARRIER_CODE]] - code - backend/src/modules/shipping/shipping.constants.ts
- [[MockCarrierAdapter]] - code - backend/src/modules/shipping/providers/mock-carrier/mock-carrier.adapter.ts
- [[SENA_EXPRESS_BASE_URL]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.constants.ts
- [[SENA_EXPRESS_CODE]] - code - backend/src/modules/shipping/shipping.constants.ts
- [[SENA_STATUSES]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.constants.ts
- [[SENA_WEBHOOK_EVENTS]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.constants.ts
- [[SEND_CONCURRENCY_BY_PROVIDER_1]] - code - backend/src/modules/shipping/shipping.constants.ts
- [[SEND_CONCURRENCY_DEFAULT_1]] - code - backend/src/modules/shipping/shipping.constants.ts
- [[SenaApiError]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.http-client.ts
- [[SenaCreateShipmentPayload]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.types.ts
- [[SenaDeliveryZone]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.types.ts
- [[SenaExpressAdapter]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.adapter.ts
- [[SenaExpressHttpClient]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.http-client.ts
- [[SenaItem]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.types.ts
- [[SenaPickupAddress]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.types.ts
- [[SenaPickupAddressDirect]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.types.ts
- [[SenaShipment]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.types.ts
- [[SenaShipmentStatus]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.constants.ts
- [[SenaShipmentStatusDict]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.types.ts
- [[SenaStockItem]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.types.ts
- [[SenaWebhookEventType]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.constants.ts
- [[SenaWebhookPayload]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.types.ts
- [[ShippingCreateShipmentInput]] - code - backend/src/modules/shipping/shipping-provider.interface.ts
- [[ShippingCreateShipmentResult]] - code - backend/src/modules/shipping/shipping-provider.interface.ts
- [[ShippingProviderCapabilities]] - code - backend/src/modules/shipping/shipping-provider.interface.ts
- [[ShippingTestResult]] - code - backend/src/modules/shipping/shipping-provider.interface.ts
- [[buildSenaNormalizedEvent()]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.webhook.util.ts
- [[carrier-native-tracking.unit.spec.ts]] - code - backend/src/modules/shipping/carrier-native-tracking.unit.spec.ts
- [[extractSenaApiKey()]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.http-client.ts
- [[formatPhoneForSena()]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.mapper.ts
- [[headerValue()_1]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.webhook.util.ts
- [[input_1]] - code - backend/src/modules/shipping/providers/mock-carrier/mock-carrier.unit.spec.ts
- [[isSenaWebhookTest()]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.webhook.util.ts
- [[makeSignature()]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.webhook.unit.spec.ts
- [[mapCreateShipmentPayload()]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.mapper.ts
- [[mapSenaShipmentToResult()]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.mapper.ts
- [[mapSenaStatusToNormalized()]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.mapper.ts
- [[matchSenaZone()]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.mapper.ts
- [[mock-carrier.adapter.ts]] - code - backend/src/modules/shipping/providers/mock-carrier/mock-carrier.adapter.ts
- [[mock-carrier.unit.spec.ts]] - code - backend/src/modules/shipping/providers/mock-carrier/mock-carrier.unit.spec.ts
- [[parseSenaZoneIdFromServiceId()]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.mapper.ts
- [[sena-express.adapter.ts]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.adapter.ts
- [[sena-express.adapter.unit.spec.ts]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.adapter.unit.spec.ts
- [[sena-express.constants.ts]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.constants.ts
- [[sena-express.http-client.ts]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.http-client.ts
- [[sena-express.mapper.ts]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.mapper.ts
- [[sena-express.mapper.unit.spec.ts]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.mapper.unit.spec.ts
- [[sena-express.types.ts]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.types.ts
- [[sena-express.webhook.unit.spec.ts]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.webhook.unit.spec.ts
- [[sena-express.webhook.util.ts]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.webhook.util.ts
- [[shipping-provider.registry.ts]] - code - backend/src/modules/shipping/shipping-provider.registry.ts
- [[shipping-webhook.controller.ts]] - code - backend/src/modules/shipping/shipping-webhook.controller.ts
- [[shipping.constants.ts]] - code - backend/src/modules/shipping/shipping.constants.ts
- [[shipping.module.ts]] - code - backend/src/modules/shipping/shipping.module.ts
- [[verifySenaSignature()]] - code - backend/src/modules/shipping/providers/sena-express/sena-express.webhook.util.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/shippingmodulets
SORT file.name ASC
```

## Connections to other communities
- 44 edges to [[_COMMUNITY_sila-sy.adapter.ts]]
- 40 edges to [[_COMMUNITY_shipping-tracking.service.ts]]
- 33 edges to [[_COMMUNITY_babel-express.adapter.ts]]
- 20 edges to [[_COMMUNITY_shipping-preflight.ts]]
- 19 edges to [[_COMMUNITY_app.module.ts]]
- 13 edges to [[_COMMUNITY_sila-webhook.util.ts]]
- 11 edges to [[_COMMUNITY_@nestjscommon]]
- 9 edges to [[_COMMUNITY_EncryptionService]]
- 7 edges to [[_COMMUNITY_shipping.service.ts]]
- 7 edges to [[_COMMUNITY_shipping.controller.ts]]
- 7 edges to [[_COMMUNITY_bulk-shipping.service.ts]]
- 5 edges to [[_COMMUNITY_ShippingProvider]]
- 3 edges to [[_COMMUNITY_shipping-fee.service.ts]]
- 3 edges to [[_COMMUNITY_@prismaclient]]
- 2 edges to [[_COMMUNITY_ShippingController]]
- 2 edges to [[_COMMUNITY_shipping-fx.service.ts]]
- 2 edges to [[_COMMUNITY_client-oms-orders.service.ts]]
- 2 edges to [[_COMMUNITY_oms-waybill.service.ts]]
- 1 edge to [[_COMMUNITY_outbound.service.ts]]
- 1 edge to [[_COMMUNITY_warehouse-tasks.controller.ts]]

## Top bridge nodes
- [[shipping.module.ts]] - degree 68, connects to 16 communities
- [[shipping-provider.registry.ts]] - degree 26, connects to 10 communities
- [[shipping.constants.ts]] - degree 39, connects to 9 communities
- [[shipping-webhook.controller.ts]] - degree 22, connects to 6 communities
- [[sena-express.adapter.ts]] - degree 39, connects to 5 communities