---
source_file: "backend/src/modules/shipping/shipping-auto-return.service.ts"
type: "code"
community: "EncryptionService"
location: "L431"
tags:
  - graphify/code
  - graphify/INFERRED
  - community/EncryptionService
---

# .confirmWarehouseReturnReceipt()

## Connections
- [[dot-appendIfAbsent()]] - `calls` [INFERRED]
- [[dot-assertConvertible()]] - `calls` [INFERRED]
- [[dot-confirmWarehouseReturnReceiptForOrder()]] - `calls` [EXTRACTED]
- [[dot-emitOmsOrderEvent()]] - `calls` [INFERRED]
- [[dot-emitOmsReturnEvent()]] - `calls` [INFERRED]
- [[dot-markReturnedForOrder()]] - `calls` [INFERRED]
- [[dot-upsertPositiveWithMeta()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[ShippingAutoReturnService]] - `method` [EXTRACTED]

#graphify/code #graphify/INFERRED #community/EncryptionService