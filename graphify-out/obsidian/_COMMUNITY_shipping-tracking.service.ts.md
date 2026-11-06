---
type: community
cohesion: 0.04
members: 114
---

# shipping-tracking.service.ts

**Cohesion:** 0.04 - loosely connected
**Members:** 114 nodes

## Members
- [[dot-applyConfirmedShipmentCancellation()]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[dot-applyIncomingCancel()]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[dot-applyVerifiedCarrierCost()]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[dot-cancelCarrierShipmentForOrder()]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[dot-cancelShipmentsBulk()_1]] - code - backend/src/modules/oms/oms-orders.service.ts
- [[dot-clearSilaCancelMeta()]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[dot-constructor()_83]] - code - backend/src/modules/shipping/shipping-sync.scheduler.ts
- [[dot-constructor()_84]] - code - backend/src/modules/shipping/sila-event-sync.service.ts
- [[dot-credentialsFromConnection()]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[dot-finalizeTrackingHistoryIdentity()]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[dot-getLocalShipmentMovement()]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[dot-getShipmentTrackingHistory()]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[dot-handlePeriodicTrackingSync()]] - code - backend/src/modules/shipping/shipping-sync.scheduler.ts
- [[dot-handlePreDispatchCarrierFailure()]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[dot-handleSilaUpdatedSinceSync()]] - code - backend/src/modules/shipping/shipping-sync.scheduler.ts
- [[dot-isPreOfd()]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[dot-lookupNotFoundEvent()]] - code - backend/src/modules/shipping/providers/babel-express/babel-express.adapter.ts
- [[dot-persistConfirmedSilaCourier()]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[dot-persistSilaCarrierAwb()]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[dot-persistSilaIdentityFromHistory()]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[dot-persistUnconfirmedProviderLookup()]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[dot-pollTracking()_1]] - code - backend/src/modules/shipping/providers/babel-express/babel-express.adapter.ts
- [[dot-processTrackingEvent()]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[dot-refreshSilaCarrierIdentifiers()]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[dot-requestSilaCancel()]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[dot-syncShipmentByAwb()]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[dot-targetOmsStatus()]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[dot-withSilaAlternateHistory()]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[dot-writeSilaCancelMeta()]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[ACTIVE_CARRIER_SHIPMENT_WHERE]] - code - backend/src/modules/shipping/shipping-lifecycle.util.ts
- [[BabelLookupMeta]] - code - backend/src/modules/shipping/shipping-lookup.util.ts
- [[CancelShipmentResult_1]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[CarrierResolutionInput]] - code - backend/src/modules/shipping/shipping-carrier-resolver.ts
- [[CarrierShipmentActivity]] - code - backend/src/modules/shipping/shipping-lifecycle.util.ts
- [[ConfirmedCourier]] - code - backend/src/modules/shipping/shipping-lifecycle.util.ts
- [[Cron]] - code
- [[EMDAD_OWNED_META_KEYS]] - code - backend/src/modules/shipping/providers/sila-sy/sila-meta.util.ts
- [[INACTIVE_CARRIER_SHIPMENT_STATUSES]] - code - backend/src/modules/shipping/shipping-lifecycle.util.ts
- [[Injectable_55]] - code
- [[Injectable_56]] - code
- [[Injectable_57]] - code
- [[KNOWN_COURIERS]] - code - backend/src/modules/shipping/shipping-carrier-resolver.ts
- [[LEFT_WAREHOUSE_STATUSES]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[NormalizedTrackingEvent]] - code - backend/src/modules/shipping/shipping-provider.interface.ts
- [[NormalizedTrackingStatus]] - code - backend/src/modules/shipping/shipping-provider.interface.ts
- [[PRE_DISPATCH_UNLOCK_OMS]] - code - backend/src/modules/shipping/shipping-lifecycle.util.ts
- [[PROVIDER_LOOKUP_NOT_FOUND_EVENT]] - code - backend/src/modules/shipping/shipping-lookup.util.ts
- [[STATUS_PROGRESS_RANK]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[ShipmentActivityState]] - code - backend/src/modules/shipping/shipping-lookup.util.ts
- [[ShipmentLookupState]] - code - backend/src/modules/shipping/shipping-lookup.util.ts
- [[ShipmentTrackingResult]] - code - backend/src/modules/shipping/shipping-provider.interface.ts
- [[ShippingCancelResult]] - code - backend/src/modules/shipping/shipping-provider.interface.ts
- [[ShippingHubOption]] - code - backend/src/modules/shipping/shipping-provider.interface.ts
- [[ShippingLabelDelivery]] - code - backend/src/modules/shipping/shipping-provider.interface.ts
- [[ShippingSyncScheduler]] - code - backend/src/modules/shipping/shipping-sync.scheduler.ts
- [[ShippingTrackingService]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[SilaCancelMeta]] - code - backend/src/modules/shipping/providers/sila-sy/sila-meta.util.ts
- [[SilaCancelState]] - code - backend/src/modules/shipping/providers/sila-sy/sila-meta.util.ts
- [[SilaEventSyncService]] - code - backend/src/modules/shipping/sila-event-sync.service.ts
- [[TERMINAL_NO_UNLOCK_OMS]] - code - backend/src/modules/shipping/shipping-lifecycle.util.ts
- [[applyConfirmedCarrierAwbToMeta()]] - code - backend/src/modules/shipping/providers/sila-sy/sila-meta.util.ts
- [[asMetaRecord()]] - code - backend/src/modules/shipping/providers/sila-sy/sila-meta.util.ts
- [[babel-cancellation.reconciliation.unit.spec.ts]] - code - backend/src/modules/shipping/babel-cancellation.reconciliation.unit.spec.ts
- [[carrier-status-matrix.unit.spec.ts]] - code - backend/src/modules/shipping/carrier-status-matrix.unit.spec.ts
- [[carrierUnlinkPatch()]] - code - backend/src/modules/shipping/shipping-lifecycle.util.ts
- [[confirmedCourierReassignment()]] - code - backend/src/modules/shipping/shipping-lifecycle.util.ts
- [[courierIdFromServiceId()]] - code - backend/src/modules/shipping/providers/sila-sy/sila-identifiers.ts
- [[courierNameFromMeta()]] - code - backend/src/modules/shipping/shipping-carrier-resolver.ts
- [[createMockPagePdfBuffer()]] - code - backend/src/modules/oms/oms-waybill.service.unit.spec.ts
- [[displayNameForProviderCode()]] - code - backend/src/modules/shipping/shipping-carrier-resolver.ts
- [[dynamicCourierRegistry]] - code - backend/src/modules/shipping/shipping-carrier-resolver.ts
- [[encryption.service.ts]] - code - backend/src/common/crypto/encryption.service.ts
- [[hubIdFromFingerprint()]] - code - backend/src/modules/shipping/shipping-lifecycle.util.ts
- [[inactiveShipmentState()]] - code - backend/src/modules/shipping/shipping-lookup.util.ts
- [[isActiveCarrierShipment()]] - code - backend/src/modules/shipping/shipping-lifecycle.util.ts
- [[isBabelShipmentNotFoundMessage()]] - code - backend/src/modules/shipping/shipping-lookup.util.ts
- [[isCancellationUnconfirmed()]] - code - backend/src/modules/shipping/shipping-lookup.util.ts
- [[isProviderLookupNotFoundEvent()]] - code - backend/src/modules/shipping/shipping-lookup.util.ts
- [[isProviderName()]] - code - backend/src/modules/shipping/shipping-carrier-resolver.ts
- [[isSilaPendingCancelMeta()]] - code - backend/src/modules/shipping/shipping-lifecycle.util.ts
- [[leftoverAwbCompatibleWithProvider()]] - code - backend/src/modules/shipping/shipping.service.ts
- [[mayUnlockToShippingDetails()]] - code - backend/src/modules/shipping/shipping-lifecycle.util.ts
- [[mergeShipmentRawMeta()]] - code - backend/src/modules/shipping/providers/sila-sy/sila-meta.util.ts
- [[nameFromCourierId()]] - code - backend/src/modules/shipping/shipping-carrier-resolver.ts
- [[normalizeCourierDisplayName()]] - code - backend/src/modules/shipping/shipping-carrier-resolver.ts
- [[normalizeWaybillScanCode()]] - code - backend/src/modules/shipping/shipping-lifecycle.util.ts
- [[oms-waybill.service.unit.spec.ts]] - code - backend/src/modules/oms/oms-waybill.service.unit.spec.ts
- [[omsStatusAfterPreDispatchUnlock()]] - code - backend/src/modules/shipping/shipping-lifecycle.util.ts
- [[outboundStatusAfterPreDispatchUnlock()]] - code - backend/src/modules/shipping/shipping-lifecycle.util.ts
- [[pre-dispatch-cancel-flow.unit.spec.ts]] - code - backend/src/modules/shipping/pre-dispatch-cancel-flow.unit.spec.ts
- [[readBabelLookupMeta()]] - code - backend/src/modules/shipping/shipping-lookup.util.ts
- [[readSilaCancelMeta()]] - code - backend/src/modules/shipping/providers/sila-sy/sila-meta.util.ts
- [[registerCourierName()]] - code - backend/src/modules/shipping/shipping-carrier-resolver.ts
- [[requireHubSelection()]] - code - backend/src/modules/shipping/shipping-lifecycle.util.ts
- [[resolveShippingCarrierName()]] - code - backend/src/modules/shipping/shipping-carrier-resolver.ts
- [[shipmentLookupOr()]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[shipmentSendGuard()]] - code - backend/src/modules/shipping/shipping-lifecycle.util.ts
- [[shipmentWithOms()]] - code - backend/src/modules/shipping/babel-cancellation.reconciliation.unit.spec.ts
- [[shipmentWithOms()_1]] - code - backend/src/modules/shipping/shipping-tracking.service.unit.spec.ts
- [[shipping-carrier-resolver.ts]] - code - backend/src/modules/shipping/shipping-carrier-resolver.ts
- [[shipping-carrier-resolver.unit.spec.ts]] - code - backend/src/modules/shipping/shipping-carrier-resolver.unit.spec.ts
- [[shipping-lifecycle.util.ts]] - code - backend/src/modules/shipping/shipping-lifecycle.util.ts
- [[shipping-lifecycle.util.unit.spec.ts]] - code - backend/src/modules/shipping/shipping-lifecycle.util.unit.spec.ts
- [[shipping-lookup.util.ts]] - code - backend/src/modules/shipping/shipping-lookup.util.ts
- [[shipping-lookup.util.unit.spec.ts]] - code - backend/src/modules/shipping/shipping-lookup.util.unit.spec.ts
- [[shipping-provider.interface.ts]] - code - backend/src/modules/shipping/shipping-provider.interface.ts
- [[shipping-sync.scheduler.ts]] - code - backend/src/modules/shipping/shipping-sync.scheduler.ts
- [[shipping-tracking.service.ts]] - code - backend/src/modules/shipping/shipping-tracking.service.ts
- [[shipping-tracking.service.unit.spec.ts]] - code - backend/src/modules/shipping/shipping-tracking.service.unit.spec.ts
- [[shouldApplyTrackingToOrder()]] - code - backend/src/modules/shipping/shipping-lifecycle.util.ts
- [[sila-event-sync.service.ts]] - code - backend/src/modules/shipping/sila-event-sync.service.ts
- [[sila-meta.util.ts]] - code - backend/src/modules/shipping/providers/sila-sy/sila-meta.util.ts
- [[sila-meta.util.unit.spec.ts]] - code - backend/src/modules/shipping/providers/sila-sy/sila-meta.util.unit.spec.ts
- [[withSilaCancelMeta()]] - code - backend/src/modules/shipping/providers/sila-sy/sila-meta.util.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/shipping-trackingservicets
SORT file.name ASC
```

## Connections to other communities
- 40 edges to [[_COMMUNITY_shipping.module.ts]]
- 27 edges to [[_COMMUNITY_sila-sy.adapter.ts]]
- 26 edges to [[_COMMUNITY_withTenantRls]]
- 24 edges to [[_COMMUNITY_shipping.service.ts]]
- 22 edges to [[_COMMUNITY_@prismaclient]]
- 20 edges to [[_COMMUNITY_oms-waybill.service.ts]]
- 19 edges to [[_COMMUNITY_babel-express.adapter.ts]]
- 13 edges to [[_COMMUNITY_EncryptionService]]
- 10 edges to [[_COMMUNITY_shipping-preflight.ts]]
- 7 edges to [[_COMMUNITY_outbound.service.ts]]
- 6 edges to [[_COMMUNITY_@nestjscommon]]
- 5 edges to [[_COMMUNITY_sila-webhook.util.ts]]
- 5 edges to [[_COMMUNITY_OmsShippingScanService]]
- 5 edges to [[_COMMUNITY_ShippingController]]
- 4 edges to [[_COMMUNITY_shipping.controller.ts]]
- 3 edges to [[_COMMUNITY_ShippingProvider]]
- 2 edges to [[_COMMUNITY_OmsBatchMembershipDto]]
- 2 edges to [[_COMMUNITY_RealtimeService]]
- 2 edges to [[_COMMUNITY_AuthPrincipal]]
- 2 edges to [[_COMMUNITY_oms-orders-list-filters.util.ts]]
- 2 edges to [[_COMMUNITY_omsoms-operational-stage.ts]]
- 1 edge to [[_COMMUNITY_task-inventory-effects.service.ts]]
- 1 edge to [[_COMMUNITY_CurrentUser]]
- 1 edge to [[_COMMUNITY_dot-validateResourceOwnership]]
- 1 edge to [[_COMMUNITY_app.module.ts]]
- 1 edge to [[_COMMUNITY_reliability-test-helpers.ts]]
- 1 edge to [[_COMMUNITY_backendpackage.json]]

## Top bridge nodes
- [[shipping-tracking.service.ts]] - degree 75, connects to 13 communities
- [[shipping-carrier-resolver.ts]] - degree 26, connects to 9 communities
- [[ShippingTrackingService]] - degree 43, connects to 8 communities
- [[encryption.service.ts]] - degree 12, connects to 8 communities
- [[shipping-provider.interface.ts]] - degree 38, connects to 7 communities