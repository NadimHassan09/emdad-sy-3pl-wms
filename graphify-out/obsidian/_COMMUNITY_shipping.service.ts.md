---
type: community
cohesion: 0.04
members: 116
---

# shipping.service.ts

**Cohesion:** 0.04 - loosely connected
**Members:** 116 nodes

## Members
- [[dot-assertAllEligible()]] - code - backend/src/modules/shipping/bulk-shipping.service.ts
- [[dot-assertLiveCarrierSelection()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-claimPendingShipment()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-clearCodCollection()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-collectProviderOptionsAllDeliveryTypes()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-confirmAndStart()]] - code - backend/src/modules/shipping/bulk-shipping.service.ts
- [[dot-connectProvider()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-constructor()_81]] - code - backend/src/modules/outbound/shipping-handoff-hook.service.ts
- [[dot-disconnectProvider()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-emitOutboundShippingUpdate()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-emitProgress()]] - code - backend/src/modules/shipping/bulk-shipping.service.ts
- [[dot-ensureSeedProviders()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-ensureShipmentForOutbound()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-failClaim()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-get()_1]] - code - backend/src/modules/shipping/shipping-provider.registry.ts
- [[dot-getConfiguredPickupParty()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-getDecryptedCredentials()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-getJob()]] - code - backend/src/modules/shipping/bulk-shipping.service.ts
- [[dot-getLabelsForJob()]] - code - backend/src/modules/shipping/bulk-shipping.service.ts
- [[dot-getLatestShipment()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-getProviderView()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-has()]] - code - backend/src/modules/shipping/shipping-provider.registry.ts
- [[dot-listEligible()]] - code - backend/src/modules/shipping/bulk-shipping.service.ts
- [[dot-listEnabledProvidersForQuote()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-listProviders()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-listSelectableProviders()]] - code - backend/src/modules/shipping/bulk-shipping.service.ts
- [[dot-loadOrdersForBulk()]] - code - backend/src/modules/shipping/bulk-shipping.service.ts
- [[dot-lookupAreaBoundary()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-onModuleInit()_1]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-onReadyForShipping()]] - code - backend/src/modules/outbound/shipping-handoff-hook.service.ts
- [[dot-persistCreatedFromExistingAwb()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-persistFailedShipment()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-preview()]] - code - backend/src/modules/shipping/bulk-shipping.service.ts
- [[dot-processItem()]] - code - backend/src/modules/shipping/bulk-shipping.service.ts
- [[dot-processJob()]] - code - backend/src/modules/shipping/bulk-shipping.service.ts
- [[dot-quoteDestinationRates()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-quoteDestinationRatesUncached()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-recomputeJobCounts()]] - code - backend/src/modules/shipping/bulk-shipping.service.ts
- [[dot-requireConnectedCredentials()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-requireProvider()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-reshipOutboundWithCarrier()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-resolveBabelNeighbourhoodId()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-resolveReceiverCoordinatesFromAddress()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-retryItem()]] - code - backend/src/modules/shipping/bulk-shipping.service.ts
- [[dot-retryShipment()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-runPool()]] - code - backend/src/modules/shipping/bulk-shipping.service.ts
- [[dot-saveCodCollection()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-sendShippingDetails()]] - code - backend/src/modules/outbound/outbound.service.ts
- [[dot-testProvider()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-toJobView()]] - code - backend/src/modules/shipping/bulk-shipping.service.ts
- [[dot-toProviderView()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[dot-tryQuoteOrder()]] - code - backend/src/modules/shipping/bulk-shipping.service.ts
- [[AreaBoundary]] - code - backend/src/modules/shipping/shipping-geo.service.ts
- [[BulkShippingService]] - code - backend/src/modules/shipping/bulk-shipping.service.ts
- [[DEFAULT_QUOTE_TTL_MS]] - code - backend/src/modules/shipping/quote-freshness.ts
- [[Injectable_51]] - code
- [[Injectable_52]] - code
- [[Injectable_53]] - code
- [[OrderLineForParts]] - code - backend/src/modules/shipping/shipment-parts.util.ts
- [[PhysicalShipmentPart]] - code - backend/src/modules/shipping/shipment-parts.util.ts
- [[QuoteDestinationRatesResult]] - code - backend/src/modules/shipping/shipping.service.ts
- [[QuoteFingerprint]] - code - backend/src/modules/shipping/quote-freshness.ts
- [[ShippingCarton]] - code - backend/src/modules/shipping/shipping-cartons.types.ts
- [[ShippingCartonLine]] - code - backend/src/modules/shipping/shipping-cartons.types.ts
- [[ShippingErrorCategory]] - code - backend/src/modules/shipping/shipping-error.ts
- [[ShippingErrorContext]] - code - backend/src/modules/shipping/shipping-error.ts
- [[ShippingFailure]] - code - backend/src/modules/shipping/shipping-error.ts
- [[ShippingFieldId]] - code - backend/src/modules/shipping/shipping-error.ts
- [[ShippingHandoffHookService]] - code - backend/src/modules/outbound/shipping-handoff-hook.service.ts
- [[ShippingParty]] - code - backend/src/modules/shipping/shipping-provider.interface.ts
- [[ShippingProviderAdminView]] - code - backend/src/modules/shipping/shipping.service.ts
- [[ShippingService]] - code - backend/src/modules/shipping/shipping.service.ts
- [[assertCarrierShippingReady()]] - code - backend/src/modules/shipping/shipping-config.util.ts
- [[babelPartsFromCartons()]] - code - backend/src/modules/shipping/shipment-parts.util.ts
- [[buildDestinationKey()]] - code - backend/src/modules/shipping/quote-freshness.ts
- [[buildPartsKey()]] - code - backend/src/modules/shipping/quote-freshness.ts
- [[buildPhysicalShipmentParts()]] - code - backend/src/modules/shipping/shipment-parts.util.ts
- [[buildService()_1]] - code - backend/src/modules/shipping/shipping.service.unit.spec.ts
- [[cartonWeightKg()]] - code - backend/src/modules/shipping/shipment-parts.util.ts
- [[classifyShippingError()]] - code - backend/src/modules/shipping/shipping-error.ts
- [[collectionLabel()]] - code - backend/src/modules/shipping/shipping-error.ts
- [[confirmedCarrierDisplayName()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[confirmedCarrierIdentityPatch()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[confirmedServiceIdForProvider()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[correlation()]] - code - backend/src/modules/shipping/shipping-error.ts
- [[createQuoteFingerprint()]] - code - backend/src/modules/shipping/quote-freshness.ts
- [[deliveryTypeLabel()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[failure()]] - code - backend/src/modules/shipping/shipping-error.ts
- [[isAmbiguousCarrierFailure()]] - code - backend/src/modules/shipping/shipping-error.ts
- [[isQuoteFingerprintFresh()]] - code - backend/src/modules/shipping/quote-freshness.ts
- [[maskUsername()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[mayCreateShipment()]] - code - backend/src/modules/shipping/shipping-error.ts
- [[packShippingError()]] - code - backend/src/modules/shipping/shipping-error.ts
- [[parsePhoneForBabel()]] - code - backend/src/modules/shipping/providers/babel-express/babel-shipment.mapper.ts
- [[parseShippingCartons()]] - code - backend/src/modules/shipping/shipping-cartons.types.ts
- [[phoneTail()]] - code - backend/src/modules/shipping/shipping-error.ts
- [[publicCarrierRateError()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[quote-freshness.ts]] - code - backend/src/modules/shipping/quote-freshness.ts
- [[quote-freshness.unit.spec.ts]] - code - backend/src/modules/shipping/quote-freshness.unit.spec.ts
- [[readableShippingError()]] - code - backend/src/modules/shipping/shipping-error.ts
- [[roundCoord()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[safeErrorMessage()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[serviceIdBelongsToProvider()]] - code - backend/src/modules/shipping/shipping-carrier-resolver.ts
- [[shipment-parts.util.ts]] - code - backend/src/modules/shipping/shipment-parts.util.ts
- [[shipping-cartons.types.ts]] - code - backend/src/modules/shipping/shipping-cartons.types.ts
- [[shipping-error.ts]] - code - backend/src/modules/shipping/shipping-error.ts
- [[shipping-error.unit.spec.ts]] - code - backend/src/modules/shipping/shipping-error.unit.spec.ts
- [[shipping.service.ts]] - code - backend/src/modules/shipping/shipping.service.ts
- [[shipping.service.unit.spec.ts]] - code - backend/src/modules/shipping/shipping.service.unit.spec.ts
- [[shippingFailureFields()]] - code - backend/src/modules/shipping/shipping-error.ts
- [[toBabelWeightParts()]] - code - backend/src/modules/shipping/shipment-parts.util.ts
- [[totalCartonsVolumeCbm()]] - code - backend/src/modules/shipping/shipment-parts.util.ts
- [[totalCartonsWeightKg()]] - code - backend/src/modules/shipping/shipment-parts.util.ts
- [[totalWeightKg()]] - code - backend/src/modules/shipping/shipment-parts.util.ts
- [[unpackShippingError()]] - code - backend/src/modules/shipping/shipping-error.ts
- [[visibleShippingError()]] - code - backend/src/modules/shipping/shipping-error.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/shippingservicets
SORT file.name ASC
```

## Connections to other communities
- 28 edges to [[_COMMUNITY_withTenantRls]]
- 24 edges to [[_COMMUNITY_shipping-tracking.service.ts]]
- 22 edges to [[_COMMUNITY_ShippingController]]
- 17 edges to [[_COMMUNITY_shipping-preflight.ts]]
- 14 edges to [[_COMMUNITY_shipping.controller.ts]]
- 14 edges to [[_COMMUNITY_EncryptionService]]
- 14 edges to [[_COMMUNITY_bulk-shipping.service.ts]]
- 10 edges to [[_COMMUNITY_babel-express.adapter.ts]]
- 8 edges to [[_COMMUNITY_outbound.service.ts]]
- 7 edges to [[_COMMUNITY_shipping.module.ts]]
- 6 edges to [[_COMMUNITY_@prismaclient]]
- 5 edges to [[_COMMUNITY_RealtimeService]]
- 4 edges to [[_COMMUNITY_app.module.ts]]
- 4 edges to [[_COMMUNITY_task-inventory-effects.service.ts]]
- 4 edges to [[_COMMUNITY_shipping-fx.service.ts]]
- 3 edges to [[_COMMUNITY_client-oms-orders.service.ts]]
- 3 edges to [[_COMMUNITY_ShippingProvider]]
- 2 edges to [[_COMMUNITY_AuthPrincipal]]
- 1 edge to [[_COMMUNITY_CodRecordsService]]
- 1 edge to [[_COMMUNITY_sila-webhook.util.ts]]
- 1 edge to [[_COMMUNITY_dot-validateResourceOwnership]]
- 1 edge to [[_COMMUNITY_class-validator]]
- 1 edge to [[_COMMUNITY_@nestjscommon]]

## Top bridge nodes
- [[shipping.service.ts]] - degree 94, connects to 17 communities
- [[ShippingService]] - degree 54, connects to 12 communities
- [[dot-ensureShipmentForOutbound()]] - degree 35, connects to 7 communities
- [[BulkShippingService]] - degree 22, connects to 5 communities
- [[dot-get()_1]] - degree 22, connects to 5 communities