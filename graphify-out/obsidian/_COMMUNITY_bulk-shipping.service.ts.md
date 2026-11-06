---
type: community
cohesion: 0.11
members: 38
---

# bulk-shipping.service.ts

**Cohesion:** 0.11 - loosely connected
**Members:** 38 nodes

## Members
- [[AnnotateRateQuotesOptions]] - code - backend/src/modules/shipping/shipping-rate.util.ts
- [[BULK_SHIPPING_CONCURRENCY]] - code - backend/src/modules/shipping/shipping.constants.ts
- [[BulkSelectionInput]] - code - backend/src/modules/shipping/bulk-shipping.selection.ts
- [[BulkSelectionPatch]] - code - backend/src/modules/shipping/bulk-shipping.selection.ts
- [[BulkShippingEligibilityInput]] - code - backend/src/modules/shipping/bulk-shipping.eligibility.ts
- [[ComparisonCurrency]] - code - backend/src/modules/shipping/currency-conversion.ts
- [[DEFAULT_USD_TO_SYP_RATE]] - code - backend/src/modules/shipping/bulk-shipping.eligibility.ts
- [[FX_FALLBACK_USD_TO_SYP_1]] - code - backend/src/modules/shipping/currency-conversion.ts
- [[FX_SOURCE_ENV]] - code - backend/src/modules/shipping/currency-conversion.ts
- [[FX_SOURCE_FALLBACK]] - code - backend/src/modules/shipping/currency-conversion.ts
- [[FxRateSnapshot_1]] - code - backend/src/modules/shipping/currency-conversion.ts
- [[MANUAL_SHIPPING_CODE]] - code - backend/src/modules/shipping/shipping.constants.ts
- [[PreviewLine_1]] - code - backend/src/modules/shipping/bulk-shipping.service.ts
- [[PreviewQuote]] - code - backend/src/modules/shipping/bulk-shipping.service.ts
- [[ProviderQuoteCandidate]] - code - backend/src/modules/shipping/bulk-shipping.eligibility.ts
- [[ShippingRateError_1]] - code - backend/src/modules/shipping/shipping-rate.util.ts
- [[ShippingRateQuote_1]] - code - backend/src/modules/shipping/shipping-rate.util.ts
- [[annotateRateQuotes()]] - code - backend/src/modules/shipping/shipping-rate.util.ts
- [[bulk-shipping.eligibility.ts]] - code - backend/src/modules/shipping/bulk-shipping.eligibility.ts
- [[bulk-shipping.eligibility.unit.spec.ts]] - code - backend/src/modules/shipping/bulk-shipping.eligibility.unit.spec.ts
- [[bulk-shipping.selection.ts]] - code - backend/src/modules/shipping/bulk-shipping.selection.ts
- [[bulk-shipping.selection.unit.spec.ts]] - code - backend/src/modules/shipping/bulk-shipping.selection.unit.spec.ts
- [[bulk-shipping.service.ts]] - code - backend/src/modules/shipping/bulk-shipping.service.ts
- [[bulkSelectionPatch()]] - code - backend/src/modules/shipping/bulk-shipping.selection.ts
- [[comparableValueUsd()_1]] - code - backend/src/modules/shipping/currency-conversion.ts
- [[currency-conversion.ts]] - code - backend/src/modules/shipping/currency-conversion.ts
- [[currency-conversion.unit.spec.ts]] - code - backend/src/modules/shipping/currency-conversion.unit.spec.ts
- [[effectiveComparableCost()_1]] - code - backend/src/modules/shipping/currency-conversion.ts
- [[getFxRateSnapshot()]] - code - backend/src/modules/shipping/currency-conversion.ts
- [[getUsdToSypRate()]] - code - backend/src/modules/shipping/bulk-shipping.eligibility.ts
- [[isEligibleForBulkShipping()]] - code - backend/src/modules/shipping/bulk-shipping.eligibility.ts
- [[normalizePriceForComparison()]] - code - backend/src/modules/shipping/bulk-shipping.eligibility.ts
- [[readUsdToSypRateFromEnv()]] - code - backend/src/modules/shipping/currency-conversion.ts
- [[recommendCheapestProvider()]] - code - backend/src/modules/shipping/bulk-shipping.eligibility.ts
- [[resolveBulkProviderSelection()]] - code - backend/src/modules/shipping/bulk-shipping.eligibility.ts
- [[shipping-rate.util.ts]] - code - backend/src/modules/shipping/shipping-rate.util.ts
- [[shipping-rate.util.unit.spec.ts]] - code - backend/src/modules/shipping/shipping-rate.util.unit.spec.ts
- [[toComparableUsd()_1]] - code - backend/src/modules/shipping/currency-conversion.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/bulk-shippingservicets
SORT file.name ASC
```

## Connections to other communities
- 14 edges to [[_COMMUNITY_shipping.service.ts]]
- 7 edges to [[_COMMUNITY_@prismaclient]]
- 7 edges to [[_COMMUNITY_shipping.module.ts]]
- 2 edges to [[_COMMUNITY_RealtimeService]]
- 1 edge to [[_COMMUNITY_EncryptionService]]
- 1 edge to [[_COMMUNITY_ShippingController]]
- 1 edge to [[_COMMUNITY_class-validator]]
- 1 edge to [[_COMMUNITY_shipping.controller.ts]]
- 1 edge to [[_COMMUNITY_@nestjscommon]]

## Top bridge nodes
- [[bulk-shipping.service.ts]] - degree 27, connects to 9 communities
- [[bulk-shipping.eligibility.ts]] - degree 18, connects to 2 communities
- [[bulk-shipping.eligibility.unit.spec.ts]] - degree 7, connects to 2 communities
- [[shipping-rate.util.ts]] - degree 11, connects to 1 community
- [[annotateRateQuotes()]] - degree 7, connects to 1 community