---
source_file: "backend/src/modules/shipping/shipping-fee.calculator.ts"
type: "code"
community: "shipping-fee.service.ts"
location: "L49"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/shipping-feeservicets
---

# assertFiniteNonNegative()

## Connections
- [[ShippingFeeValidationError]] - `calls` [EXTRACTED]
- [[assertWeightRule()]] - `calls` [EXTRACTED]
- [[quoteClientShippingRate()]] - `calls` [EXTRACTED]
- [[quoteExternalPerKg()]] - `calls` [EXTRACTED]
- [[shipping-fee.calculator.ts]] - `contains` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/shipping-feeservicets