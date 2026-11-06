---
source_file: "backend/src/modules/oms/oms-cancel-revert.ts"
type: "code"
community: "outbound.service.ts"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/outboundservicets
---

# oms-cancel-revert.ts

## Connections
- [[@prismaclient]] - `imports_from` [EXTRACTED]
- [[CANCEL_EVENT_TYPES]] - `contains` [EXTRACTED]
- [[CLIENT_CANCEL_REVERT_STATUSES]] - `contains` [EXTRACTED]
- [[CancelTimelineEvent]] - `contains` [EXTRACTED]
- [[EVENT_TYPE_TO_OMS]] - `contains` [EXTRACTED]
- [[InvalidStateException]] - `imports` [EXTRACTED]
- [[OMS_FULFILLMENT_RESTORE_STATUSES]] - `contains` [EXTRACTED]
- [[OMS_STATUS_VALUES]] - `contains` [EXTRACTED]
- [[OUTBOUND_STATUS_VALUES]] - `contains` [EXTRACTED]
- [[OmsTransitionActor]] - `imports` [EXTRACTED]
- [[UNSAFE_OMS_RESTORE_STATUSES]] - `contains` [EXTRACTED]
- [[UNSAFE_OUTBOUND_RESTORE_STATUSES]] - `contains` [EXTRACTED]
- [[assertPreviousOmsStatusOrThrow()]] - `contains` [EXTRACTED]
- [[canRevertCancel()]] - `contains` [EXTRACTED]
- [[clientMayRevertTo()]] - `contains` [EXTRACTED]
- [[domain-exceptions.ts]] - `imports_from` [EXTRACTED]
- [[isRestorableOmsStatus()]] - `contains` [EXTRACTED]
- [[isRestorableOutboundStatus()]] - `contains` [EXTRACTED]
- [[needsReallocation()]] - `contains` [EXTRACTED]
- [[oms-cancel-revert.unit.spec.ts]] - `imports_from` [EXTRACTED]
- [[oms-order-transitions.ts]] - `imports_from` [EXTRACTED]
- [[oms-orders.service.ts]] - `imports_from` [EXTRACTED]
- [[parseOmsStatus()]] - `contains` [EXTRACTED]
- [[parseOutboundStatus()]] - `contains` [EXTRACTED]
- [[resolveOutboundRestoreStatus()]] - `contains` [EXTRACTED]
- [[resolvePreviousOmsStatus()]] - `contains` [EXTRACTED]
- [[shipping-tracking.service.ts]] - `imports_from` [EXTRACTED]
- [[snapshotOnEnteringCancelled()]] - `contains` [EXTRACTED]
- [[statusFromEvent()]] - `contains` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/outboundservicets