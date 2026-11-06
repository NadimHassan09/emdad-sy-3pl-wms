---
source_file: "backend/src/modules/oms/oms-order-delete.policy.ts"
type: "code"
community: "outbound.service.ts"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/outboundservicets
---

# oms-order-delete.policy.ts

## Connections
- [[@prismaclient]] - `imports_from` [EXTRACTED]
- [[InvalidStateException]] - `imports` [EXTRACTED]
- [[assertOmsOrderDeletable()]] - `contains` [EXTRACTED]
- [[domain-exceptions.ts]] - `imports_from` [EXTRACTED]
- [[isOmsOrderDeletable()]] - `contains` [EXTRACTED]
- [[oms-order-delete.policy.unit.spec.ts]] - `imports_from` [EXTRACTED]
- [[oms-orders.service.ts]] - `imports_from` [EXTRACTED]
- [[omsOrderDeleteBlockedMessage()]] - `contains` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/outboundservicets