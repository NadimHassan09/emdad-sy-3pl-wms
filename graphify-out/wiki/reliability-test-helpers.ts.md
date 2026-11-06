# reliability-test-helpers.ts

> 46 nodes · cohesion 0.15

## Key Concepts

- **reliability-test-helpers.ts** (57 connections) — `backend/src/integration-tests/sprint2/reliability-test-helpers.ts`
- **sprint2-reliability.integration.ts** (32 connections) — `backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts`
- **ref_node_crypto** (22 connections)
- **createServiceDeps()** (20 connections) — `backend/src/integration-tests/sprint2/reliability-test-helpers.ts`
- **LedgerIdempotencyService** (18 connections) — `backend/src/modules/inventory/ledger-idempotency.service.ts`
- **assertEq()** (16 connections) — `backend/src/integration-tests/sprint2/reliability-test-helpers.ts`
- **runAll()** (16 connections) — `backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts`
- **createOutboundServiceDeps()** (14 connections) — `backend/src/integration-tests/sprint2/reliability-test-helpers.ts`
- **createBaseFixture()** (13 connections) — `backend/src/integration-tests/sprint2/reliability-test-helpers.ts`
- **seedOnHand()** (13 connections) — `backend/src/integration-tests/sprint2/reliability-test-helpers.ts`
- **cleanupFixture()** (12 connections) — `backend/src/integration-tests/sprint2/reliability-test-helpers.ts`
- **WorkflowEngineService** (11 connections) — `backend/src/modules/warehouse-workflow/workflow-engine.service.ts`
- **testDispatchCancelReservationCleanup()** (9 connections) — `backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts`
- **testOrphanReservationReleaseByCancelRemaining()** (9 connections) — `backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts`
- **testPickFailReservationCleanup()** (9 connections) — `backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts`
- **testReopenReReserveFlow()** (9 connections) — `backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts`
- **readReserved()** (8 connections) — `backend/src/integration-tests/sprint2/reliability-test-helpers.ts`
- **reserveWithSnapshot()** (8 connections) — `backend/src/integration-tests/sprint2/reliability-test-helpers.ts`
- **testConcurrentPickStart()** (8 connections) — `backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts`
- **testReservationInvariantRollback()** (8 connections) — `backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts`
- **testConcurrentOutboundConfirmAtomicShip()** (7 connections) — `backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts`
- **testDispatchUsesBoundPickReservations()** (7 connections) — `backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts`
- **testDuplicateOutboundConfirmReplay()** (7 connections) — `backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts`
- **cleanupDraftOutboundFixture()** (6 connections) — `backend/src/integration-tests/sprint2/reliability-test-helpers.ts`
- **createDraftOutboundFixture()** (6 connections) — `backend/src/integration-tests/sprint2/reliability-test-helpers.ts`
- *... and 21 more nodes in this community*

## Relationships

- [@prisma/client](@prisma-client.md) (20 shared connections)
- [task-inventory-effects.service.ts](task-inventory-effects.service.ts.md) (13 shared connections)
- [warehouse-tasks.service.ts](warehouse-tasks.service.ts.md) (12 shared connections)
- [AuditLogService](AuditLogService.md) (8 shared connections)
- [inventory-consistency.service.ts](inventory-consistency.service.ts.md) (4 shared connections)
- [app.module.ts](app.module.ts.md) (4 shared connections)
- [RealtimeService](RealtimeService.md) (2 shared connections)
- [NotificationsService](NotificationsService.md) (2 shared connections)
- [WarehouseTasksService](WarehouseTasksService.md) (2 shared connections)
- [CacheInvalidationService](CacheInvalidationService.md) (2 shared connections)
- [withTenantRls](withTenantRls.md) (2 shared connections)
- [outbound.service.ts](outbound.service.ts.md) (2 shared connections)

## Source Files

- `backend/src/integration-tests/sprint2/reliability-test-helpers.ts`
- `backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts`
- `backend/src/modules/inventory/ledger-idempotency.service.ts`
- `backend/src/modules/warehouse-workflow/workflow-bootstrap.service.ts`
- `backend/src/modules/warehouse-workflow/workflow-engine.service.ts`

## Audit Trail

- EXTRACTED: 236 (93%)
- INFERRED: 17 (7%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*