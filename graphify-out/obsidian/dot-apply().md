---
source_file: "backend/src/modules/oms/oms-shipping-scan.service.ts"
type: "code"
community: "OmsShippingScanService"
location: "L39"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/OmsShippingScanService
---

# .apply()

## Connections
- [[dot-confirmHandover()]] - `calls` [EXTRACTED]
- [[dot-confirmReadyToShip()]] - `calls` [EXTRACTED]
- [[dot-findOrderForScan()]] - `calls` [EXTRACTED]
- [[dot-findShipmentByScan()]] - `calls` [EXTRACTED]
- [[dot-scanMatchesOrderOrActiveShipment()]] - `calls` [EXTRACTED]
- [[dot-scanShippingTransition()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[OmsShippingScanAction]] - `references` [EXTRACTED]
- [[OmsShippingScanService]] - `method` [EXTRACTED]
- [[isActiveCarrierShipment()]] - `calls` [EXTRACTED]
- [[normalizeWaybillScanCode()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/OmsShippingScanService