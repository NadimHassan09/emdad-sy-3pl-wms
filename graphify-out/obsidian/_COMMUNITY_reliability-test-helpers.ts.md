---
type: community
cohesion: 0.15
members: 46
---

# reliability-test-helpers.ts

**Cohesion:** 0.15 - loosely connected
**Members:** 46 nodes

## Members
- [[dot-constructor()_220]] - code - backend/src/modules/inventory/ledger-idempotency.service.ts
- [[dot-constructor()_221]] - code - backend/src/modules/warehouse-workflow/workflow-bootstrap.service.ts
- [[dot-constructor()_222]] - code - backend/src/modules/warehouse-workflow/workflow-engine.service.ts
- [[BaseFixture]] - code - backend/src/integration-tests/sprint2/reliability-test-helpers.ts
- [[DraftOutboundFixture]] - code - backend/src/integration-tests/sprint2/reliability-test-helpers.ts
- [[Injectable_157]] - code
- [[Injectable_158]] - code
- [[LedgerIdempotencyService]] - code - backend/src/modules/inventory/ledger-idempotency.service.ts
- [[OutboundServiceDeps]] - code - backend/src/integration-tests/sprint2/reliability-test-helpers.ts
- [[ServiceDeps]] - code - backend/src/integration-tests/sprint2/reliability-test-helpers.ts
- [[TestCase_1]] - code - backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts
- [[WorkflowEngineDeps]] - code - backend/src/integration-tests/sprint2/reliability-test-helpers.ts
- [[WorkflowEngineService]] - code - backend/src/modules/warehouse-workflow/workflow-engine.service.ts
- [[assertEq()]] - code - backend/src/integration-tests/sprint2/reliability-test-helpers.ts
- [[cleanupDraftOutboundFixture()]] - code - backend/src/integration-tests/sprint2/reliability-test-helpers.ts
- [[cleanupFixture()]] - code - backend/src/integration-tests/sprint2/reliability-test-helpers.ts
- [[companyAccessMock()_7]] - code - backend/src/integration-tests/sprint2/reliability-test-helpers.ts
- [[configMock()]] - code - backend/src/integration-tests/sprint2/reliability-test-helpers.ts
- [[createBaseFixture()]] - code - backend/src/integration-tests/sprint2/reliability-test-helpers.ts
- [[createDraftOutboundFixture()]] - code - backend/src/integration-tests/sprint2/reliability-test-helpers.ts
- [[createOutboundServiceDeps()]] - code - backend/src/integration-tests/sprint2/reliability-test-helpers.ts
- [[createServiceDeps()]] - code - backend/src/integration-tests/sprint2/reliability-test-helpers.ts
- [[createWorkflowEngineDeps()]] - code - backend/src/integration-tests/sprint2/reliability-test-helpers.ts
- [[readReserved()]] - code - backend/src/integration-tests/sprint2/reliability-test-helpers.ts
- [[ref_node_assert]] - concept
- [[ref_node_crypto]] - concept
- [[reliability-test-helpers.ts]] - code - backend/src/integration-tests/sprint2/reliability-test-helpers.ts
- [[reserveWithSnapshot()]] - code - backend/src/integration-tests/sprint2/reliability-test-helpers.ts
- [[runAll()]] - code - backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts
- [[seedOnHand()]] - code - backend/src/integration-tests/sprint2/reliability-test-helpers.ts
- [[sprint2-reliability.integration.ts]] - code - backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts
- [[testConcurrentOutboundConfirmAtomicShip()]] - code - backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts
- [[testConcurrentOutboundConfirmTaskFlow()]] - code - backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts
- [[testConcurrentPickStart()]] - code - backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts
- [[testConcurrentWorkflowBootstrap()]] - code - backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts
- [[testDispatchCancelReservationCleanup()]] - code - backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts
- [[testDispatchUsesBoundPickReservations()]] - code - backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts
- [[testDuplicateDispatchComplete()]] - code - backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts
- [[testDuplicateOutboundConfirmReplay()]] - code - backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts
- [[testDuplicatePickComplete()]] - code - backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts
- [[testInventoryConsistencyValidate()]] - code - backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts
- [[testOrphanReservationReleaseByCancelRemaining()]] - code - backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts
- [[testPickFailReservationCleanup()]] - code - backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts
- [[testReopenReReserveFlow()]] - code - backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts
- [[testReservationInvariantRollback()]] - code - backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts
- [[testWebsocketReplaySafety()]] - code - backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/reliability-test-helpersts
SORT file.name ASC
```

## Connections to other communities
- 20 edges to [[_COMMUNITY_@prismaclient]]
- 13 edges to [[_COMMUNITY_task-inventory-effects.service.ts]]
- 12 edges to [[_COMMUNITY_warehouse-tasks.service.ts]]
- 8 edges to [[_COMMUNITY_AuditLogService]]
- 4 edges to [[_COMMUNITY_inventory-consistency.service.ts]]
- 4 edges to [[_COMMUNITY_app.module.ts]]
- 2 edges to [[_COMMUNITY_withTenantRls]]
- 2 edges to [[_COMMUNITY_WarehouseTasksService]]
- 2 edges to [[_COMMUNITY_RealtimeService]]
- 2 edges to [[_COMMUNITY_NotificationsService]]
- 2 edges to [[_COMMUNITY_outbound.service.ts]]
- 2 edges to [[_COMMUNITY_returns.service.ts]]
- 2 edges to [[_COMMUNITY_CodRecordsService]]
- 2 edges to [[_COMMUNITY_CacheInvalidationService]]
- 1 edge to [[_COMMUNITY_TaskReadCacheService]]
- 1 edge to [[_COMMUNITY_AuthPrincipal]]
- 1 edge to [[_COMMUNITY_outbound-orders-csv.service.ts]]
- 1 edge to [[_COMMUNITY_main.ts]]
- 1 edge to [[_COMMUNITY_inbound-orders-csv.service.ts]]
- 1 edge to [[_COMMUNITY_perf-dataset-expansion.cjs]]
- 1 edge to [[_COMMUNITY_performance-dataset-certification.cjs]]
- 1 edge to [[_COMMUNITY_oms-sales-channel.service.ts]]
- 1 edge to [[_COMMUNITY_shipping-tracking.service.ts]]
- 1 edge to [[_COMMUNITY_oms-client-import.service.ts]]
- 1 edge to [[_COMMUNITY_performance-bulk-seed.cjs]]
- 1 edge to [[_COMMUNITY_grn-pdf.service.ts]]
- 1 edge to [[_COMMUNITY_api-credentials.service.ts]]
- 1 edge to [[_COMMUNITY_inventory.service.ts]]
- 1 edge to [[_COMMUNITY_@nestjscommon]]
- 1 edge to [[_COMMUNITY_observability.service.ts]]

## Top bridge nodes
- [[ref_node_crypto]] - degree 22, connects to 16 communities
- [[reliability-test-helpers.ts]] - degree 57, connects to 14 communities
- [[LedgerIdempotencyService]] - degree 18, connects to 6 communities
- [[createOutboundServiceDeps()]] - degree 14, connects to 5 communities
- [[createServiceDeps()]] - degree 20, connects to 4 communities