---
source_file: "backend/src/integration-tests/sprint2/reliability-test-helpers.ts"
type: "code"
community: "reliability-test-helpers.ts"
location: "L170"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/reliability-test-helpersts
---

# createOutboundServiceDeps()

## Connections
- [[InventoryConsistencyService]] - `calls` [EXTRACTED]
- [[LedgerIdempotencyService]] - `calls` [EXTRACTED]
- [[OutboundService]] - `calls` [EXTRACTED]
- [[PrismaService]] - `calls` [EXTRACTED]
- [[StockHelpers]] - `calls` [EXTRACTED]
- [[WorkflowBootstrapService]] - `calls` [EXTRACTED]
- [[WorkflowEngineService]] - `calls` [EXTRACTED]
- [[companyAccessMock()_7]] - `calls` [EXTRACTED]
- [[configMock()]] - `calls` [EXTRACTED]
- [[reliability-test-helpers.ts]] - `contains` [EXTRACTED]
- [[sprint2-reliability.integration.ts]] - `imports` [EXTRACTED]
- [[testConcurrentOutboundConfirmAtomicShip()]] - `calls` [EXTRACTED]
- [[testConcurrentOutboundConfirmTaskFlow()]] - `calls` [EXTRACTED]
- [[testDuplicateOutboundConfirmReplay()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/reliability-test-helpersts