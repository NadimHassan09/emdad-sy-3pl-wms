---
source_file: "backend/src/modules/oms/oms-outbound-sync.service.ts"
type: "code"
community: "outbound.service.ts"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/outboundservicets
---

# oms-outbound-sync.service.ts

## Connections
- [[@nestjscommon]] - `imports_from` [EXTRACTED]
- [[@prismaclient]] - `imports_from` [EXTRACTED]
- [[OMS_PRE_FULFILLMENT]] - `imports` [EXTRACTED]
- [[OMS_TERMINAL_STATUSES]] - `imports` [EXTRACTED]
- [[OmsOrderEventsService]] - `imports` [EXTRACTED]
- [[OmsOutboundSyncService]] - `contains` [EXTRACTED]
- [[OrderAllocationService]] - `imports` [EXTRACTED]
- [[PrismaService]] - `imports` [EXTRACTED]
- [[RealtimeService]] - `imports` [EXTRACTED]
- [[Tx]] - `contains` [EXTRACTED]
- [[composeDestinationAddress()]] - `imports` [EXTRACTED]
- [[copyShippingFieldsFromOms()]] - `imports` [EXTRACTED]
- [[mapOutboundStatusToOms()]] - `imports` [EXTRACTED]
- [[oms-order-events.service.ts]] - `imports_from` [EXTRACTED]
- [[oms-order-transitions.ts]] - `imports_from` [EXTRACTED]
- [[oms-order.mapper.ts]] - `imports_from` [EXTRACTED]
- [[oms-orders.service.ts]] - `imports_from` [EXTRACTED]
- [[oms.module.ts]] - `imports_from` [EXTRACTED]
- [[omsEventTypeForStatus()]] - `imports` [EXTRACTED]
- [[order-allocation.service.ts]] - `imports_from` [EXTRACTED]
- [[outbound.service.ts]] - `imports_from` [EXTRACTED]
- [[prisma.service.ts]] - `imports_from` [EXTRACTED]
- [[realtime.service.ts]] - `imports_from` [EXTRACTED]
- [[shipping-config.util.ts]] - `imports_from` [EXTRACTED]
- [[task-inventory-effects.service.ts]] - `imports_from` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/outboundservicets