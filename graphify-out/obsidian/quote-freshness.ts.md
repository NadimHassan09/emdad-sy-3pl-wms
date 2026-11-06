---
source_file: "backend/src/modules/shipping/quote-freshness.ts"
type: "code"
community: "shipping.service.ts"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/shippingservicets
---

# quote-freshness.ts

## Connections
- [[DEFAULT_QUOTE_TTL_MS]] - `contains` [EXTRACTED]
- [[QuoteFingerprint]] - `contains` [EXTRACTED]
- [[buildDestinationKey()]] - `contains` [EXTRACTED]
- [[buildPartsKey()]] - `contains` [EXTRACTED]
- [[createQuoteFingerprint()]] - `contains` [EXTRACTED]
- [[isQuoteFingerprintFresh()]] - `contains` [EXTRACTED]
- [[quote-freshness.unit.spec.ts]] - `imports_from` [EXTRACTED]
- [[shipping-lifecycle.util.unit.spec.ts]] - `imports_from` [EXTRACTED]
- [[shipping.service.ts]] - `imports_from` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/shippingservicets