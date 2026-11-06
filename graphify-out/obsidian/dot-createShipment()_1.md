---
source_file: "backend/src/modules/shipping/providers/sila-sy/sila-sy.adapter.ts"
type: "code"
community: "sila-sy.adapter.ts"
location: "L925"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/sila-syadapterts
---

# .createShipment()

## Connections
- [[dot-fetchCargo()]] - `calls` [EXTRACTED]
- [[dot-lookupQuotedCourier()]] - `calls` [EXTRACTED]
- [[dot-narrowProvinceArea()]] - `calls` [EXTRACTED]
- [[dot-resolveAreaId()]] - `calls` [EXTRACTED]
- [[dot-resolveDuplicateReference()]] - `calls` [EXTRACTED]
- [[ShippingCreateShipmentInput]] - `references` [EXTRACTED]
- [[ShippingCreateShipmentResult]] - `references` [EXTRACTED]
- [[ShippingCredentials]] - `references` [EXTRACTED]
- [[SilaSyAdapter]] - `method` [EXTRACTED]
- [[SilaSyApiError]] - `calls` [EXTRACTED]
- [[apiKey()]] - `calls` [EXTRACTED]
- [[extractSilaCarrierAwb()]] - `calls` [EXTRACTED]
- [[extractSilaProviderId()]] - `calls` [EXTRACTED]
- [[isSilaProvinceAreaError()]] - `calls` [EXTRACTED]
- [[logSanitizedProviderRequest()]] - `calls` [EXTRACTED]
- [[parseSilaServiceInfo()]] - `calls` [EXTRACTED]
- [[pickNearestSilaBranch()]] - `calls` [EXTRACTED]
- [[resolveSilaHubOptions()]] - `calls` [EXTRACTED]
- [[sanitizeSilaCargoBody()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/sila-syadapterts