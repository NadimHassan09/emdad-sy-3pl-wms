---
source_file: "backend/src/modules/oms/oms-order-delete.policy.ts"
type: "code"
community: "outbound.service.ts"
location: "L32"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/outboundservicets
---

# assertOmsOrderDeletable()

## Connections
- [[dot-delete()_1]] - `calls` [EXTRACTED]
- [[InvalidStateException]] - `calls` [EXTRACTED]
- [[isOmsOrderDeletable()]] - `calls` [EXTRACTED]
- [[oms-order-delete.policy.ts]] - `contains` [EXTRACTED]
- [[oms-order-delete.policy.unit.spec.ts]] - `imports` [EXTRACTED]
- [[oms-orders.service.ts]] - `imports` [EXTRACTED]
- [[omsOrderDeleteBlockedMessage()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/outboundservicets