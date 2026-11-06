---
source_file: "backend/src/modules/shipping/shipping-auto-return.service.ts"
type: "code"
community: "EncryptionService"
location: "L39"
tags:
  - graphify/code
  - graphify/INFERRED
  - community/EncryptionService
---

# .processCarrierReturnEvent()

## Connections
- [[dot-activateHold()]] - `calls` [INFERRED]
- [[dot-emitOmsOrderEvent()]] - `calls` [INFERRED]
- [[dot-emitOmsReturnEvent()]] - `calls` [INFERRED]
- [[dot-markReturned()]] - `calls` [INFERRED]
- [[dot-processAutomatedReturn()]] - `calls` [EXTRACTED]
- [[dot-processTrackingEvent()]] - `calls` [INFERRED]
- [[dot-promoteOrderToReturnPendingReceipt()]] - `calls` [EXTRACTED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[ShippingAutoReturnService]] - `method` [EXTRACTED]

#graphify/code #graphify/INFERRED #community/EncryptionService