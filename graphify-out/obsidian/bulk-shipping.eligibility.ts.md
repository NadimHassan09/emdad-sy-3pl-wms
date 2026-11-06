---
source_file: "backend/src/modules/shipping/bulk-shipping.eligibility.ts"
type: "code"
community: "bulk-shipping.service.ts"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/bulk-shippingservicets
---

# bulk-shipping.eligibility.ts

## Connections
- [[@prismaclient]] - `imports_from` [EXTRACTED]
- [[BulkShippingEligibilityInput]] - `contains` [EXTRACTED]
- [[DEFAULT_USD_TO_SYP_RATE]] - `contains` [EXTRACTED]
- [[FxRateSnapshot_1]] - `imports` [EXTRACTED]
- [[MANUAL_SHIPPING_CODE]] - `imports` [EXTRACTED]
- [[ProviderQuoteCandidate]] - `contains` [EXTRACTED]
- [[bulk-shipping.eligibility.unit.spec.ts]] - `imports_from` [EXTRACTED]
- [[bulk-shipping.service.ts]] - `imports_from` [EXTRACTED]
- [[comparableValueUsd()_1]] - `imports` [EXTRACTED]
- [[currency-conversion.ts]] - `imports_from` [EXTRACTED]
- [[getFxRateSnapshot()]] - `imports` [EXTRACTED]
- [[getUsdToSypRate()]] - `contains` [EXTRACTED]
- [[isEligibleForBulkShipping()]] - `contains` [EXTRACTED]
- [[normalizePriceForComparison()]] - `contains` [EXTRACTED]
- [[recommendCheapestProvider()]] - `contains` [EXTRACTED]
- [[resolveBulkProviderSelection()]] - `contains` [EXTRACTED]
- [[shipping.constants.ts]] - `imports_from` [EXTRACTED]
- [[toComparableUsd()_1]] - `imports` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/bulk-shippingservicets