---
source_file: "backend/src/modules/shipping/shipping-fee.calculator.ts"
type: "code"
community: "shipping-fee.service.ts"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/shipping-feeservicets
---

# shipping-fee.calculator.ts

## Connections
- [[SHIPPING_FEE_ROUNDING_POLICY]] - `contains` [EXTRACTED]
- [[ShippingFeeQuote]] - `contains` [EXTRACTED]
- [[ShippingFeeQuoteInput]] - `contains` [EXTRACTED]
- [[ShippingFeeValidationError]] - `contains` [EXTRACTED]
- [[ShippingFeeWeightRule]] - `contains` [EXTRACTED]
- [[assertFiniteNonNegative()]] - `contains` [EXTRACTED]
- [[assertWeightRule()]] - `contains` [EXTRACTED]
- [[countWeightIncrements()]] - `contains` [EXTRACTED]
- [[quoteClientShippingRate()]] - `contains` [EXTRACTED]
- [[quoteExternalPerKg()]] - `contains` [EXTRACTED]
- [[roundMoney()]] - `contains` [EXTRACTED]
- [[shipping-fee.calculator.unit.spec.ts]] - `imports_from` [EXTRACTED]
- [[shipping-fee.service.ts]] - `imports_from` [EXTRACTED]
- [[toWeightUnits()]] - `contains` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/shipping-feeservicets