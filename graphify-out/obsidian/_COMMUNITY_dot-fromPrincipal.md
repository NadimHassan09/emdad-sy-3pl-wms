---
type: community
cohesion: 0.08
members: 61
---

# .fromPrincipal

**Cohesion:** 0.08 - loosely connected
**Members:** 61 nodes

## Members
- [[dot-adminConfirm()_1]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-allocateInboundExpectedLotNumber()]] - code - backend/src/modules/inbound/inbound.service.ts
- [[dot-approveAdmin()]] - code - backend/src/modules/inbound/inbound.service.ts
- [[dot-approveAdmin()_1]] - code - backend/src/modules/outbound/outbound.service.ts
- [[dot-buildListWhere()_4]] - code - backend/src/modules/inbound/inbound.service.ts
- [[dot-cancel()_11]] - code - backend/src/modules/inbound/inbound.service.ts
- [[dot-cancel()_12]] - code - backend/src/modules/returns/returns.service.ts
- [[dot-completeDispatchAdmin()]] - code - backend/src/modules/outbound/outbound.service.ts
- [[dot-completePackingAdmin()]] - code - backend/src/modules/outbound/outbound.service.ts
- [[dot-completePickingAdmin()]] - code - backend/src/modules/outbound/outbound.service.ts
- [[dot-completePutawayAdmin()_1]] - code - backend/src/modules/inbound/inbound.service.ts
- [[dot-completeReceivingAdmin()_1]] - code - backend/src/modules/inbound/inbound.service.ts
- [[dot-confirm()_6]] - code - backend/src/modules/inbound/inbound.service.ts
- [[dot-confirm()_7]] - code - backend/src/modules/returns/returns.service.ts
- [[dot-confirmAndDeduct()]] - code - backend/src/modules/outbound/outbound.service.ts
- [[dot-confirmWithoutDeduction()]] - code - backend/src/modules/outbound/outbound.service.ts
- [[dot-constructor()_204]] - code - backend/src/modules/client-portal/inbound/client-inbound-orders.service.ts
- [[dot-constructor()_205]] - code - backend/src/modules/client-portal/order-import/inbound-client-import.service.ts
- [[dot-create()_42]] - code - backend/src/modules/inbound/inbound.service.ts
- [[dot-dismissPendingAdminNotifications()]] - code - backend/src/modules/notifications/notifications.service.ts
- [[dot-emitInboundOrderUpdated()]] - code - backend/src/modules/realtime/realtime.service.ts
- [[dot-ensureDefaultExecutionPlan()]] - code - backend/src/modules/outbound/outbound.service.ts
- [[dot-executeAdmin()_2]] - code - backend/src/modules/inbound/inbound.service.ts
- [[dot-executeAdmin()_3]] - code - backend/src/modules/outbound/outbound.service.ts
- [[dot-findById()_14]] - code - backend/src/modules/inbound/inbound.service.ts
- [[dot-fromPrincipal()]] - code - backend/src/common/audit/audit-log.service.ts
- [[dot-insert()]] - code - backend/src/common/audit/audit-log.service.ts
- [[dot-isDockStagingLocationType()]] - code - backend/src/modules/inbound/inbound.service.ts
- [[dot-loadOutboundStatusSummary()]] - code - backend/src/modules/outbound/outbound.service.ts
- [[dot-log()]] - code - backend/src/common/audit/audit-log.service.ts
- [[dot-notifyClientOrderConfirmed()]] - code - backend/src/modules/notifications/notifications.service.ts
- [[dot-receiveLine()_1]] - code - backend/src/modules/returns/returns.service.ts
- [[dot-refreshInboundOrderHeadStatus()]] - code - backend/src/modules/inbound/inbound.service.ts
- [[dot-remove()_11]] - code - backend/src/modules/inbound/inbound.service.ts
- [[dot-review()_1]] - code - backend/src/modules/cycle-count/cycle-count-variance.service.ts
- [[dot-unlink()]] - code - backend/src/modules/auth/google-oauth.service.ts
- [[dot-unlinkGoogle()]] - code - backend/src/modules/auth/auth.controller.ts
- [[dot-updatePlan()_5]] - code - backend/src/modules/inbound/inbound.service.ts
- [[InboundExecutionPlan_1]] - code - backend/src/modules/orders/execution-plan.types.ts
- [[InboundExecutionPlanLine]] - code - backend/src/modules/orders/execution-plan.types.ts
- [[InboundPutawaySplit_1]] - code - backend/src/modules/orders/execution-plan.types.ts
- [[InboundService]] - code - backend/src/modules/inbound/inbound.service.ts
- [[Injectable_144]] - code
- [[OrderExecutionMode_1]] - code - backend/src/modules/orders/execution-plan.types.ts
- [[OutboundExecutionPlan_1]] - code - backend/src/modules/orders/execution-plan.types.ts
- [[OutboundSuggestedPick_1]] - code - backend/src/modules/orders/execution-plan.types.ts
- [[adminInboundListItem()]] - code - backend/src/modules/realtime/realtime-client.payload.ts
- [[assertInboundAdminPlanComplete()]] - code - backend/src/modules/orders/execution-plan.util.ts
- [[assertOutboundAdminPlanComplete()]] - code - backend/src/modules/orders/execution-plan.util.ts
- [[execution-plan.types.ts]] - code - backend/src/modules/orders/execution-plan.types.ts
- [[execution-plan.util.ts]] - code - backend/src/modules/orders/execution-plan.util.ts
- [[isAdminExecutionMode()_1]] - code - backend/src/modules/orders/execution-plan.types.ts
- [[isInboundConfirmable()]] - code - backend/src/modules/inbound/inbound.service.ts
- [[isInboundPlanEditable()]] - code - backend/src/modules/inbound/inbound.service.ts
- [[isRecord()_7]] - code - backend/src/modules/orders/execution-plan.util.ts
- [[isReturnTerminal()]] - code - backend/src/modules/returns/returns.constants.ts
- [[normalizeExecutionMode()_1]] - code - backend/src/modules/orders/execution-plan.util.ts
- [[outboundRequiresPacking()]] - code - backend/src/modules/outbound/outbound-admin-stages.ts
- [[parseInboundExecutionPlan()]] - code - backend/src/modules/orders/execution-plan.util.ts
- [[parseOutboundExecutionPlan()]] - code - backend/src/modules/orders/execution-plan.util.ts
- [[waitForOpenWarehouseTask()]] - code - backend/src/modules/outbound/outbound-admin-task.helpers.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/fromPrincipal
SORT file.name ASC
```

## Connections to other communities
- 68 edges to [[_COMMUNITY_outbound.service.ts]]
- 63 edges to [[_COMMUNITY_withTenantRls]]
- 39 edges to [[_COMMUNITY_AuthPrincipal]]
- 23 edges to [[_COMMUNITY_dot-validateResourceOwnership]]
- 16 edges to [[_COMMUNITY_WarehouseTasksService]]
- 11 edges to [[_COMMUNITY_@prismaclient]]
- 11 edges to [[_COMMUNITY_ReturnsService]]
- 10 edges to [[_COMMUNITY_inbound-orders-csv.service.ts]]
- 10 edges to [[_COMMUNITY_RealtimeService]]
- 10 edges to [[_COMMUNITY_InboundController]]
- 8 edges to [[_COMMUNITY_WarehousesService]]
- 7 edges to [[_COMMUNITY_dot-assertCompanyAccess]]
- 7 edges to [[_COMMUNITY_oms-instruction-pdf.service.ts]]
- 7 edges to [[_COMMUNITY_returns.service.ts]]
- 6 edges to [[_COMMUNITY_ProductsService]]
- 6 edges to [[_COMMUNITY_AuthService]]
- 5 edges to [[_COMMUNITY_CycleCountService]]
- 5 edges to [[_COMMUNITY_@nestjscommon]]
- 5 edges to [[_COMMUNITY_AuditLogService]]
- 5 edges to [[_COMMUNITY_NotificationsService]]
- 4 edges to [[_COMMUNITY_RunReportQueryDto]]
- 3 edges to [[_COMMUNITY_GoogleOAuthService]]
- 3 edges to [[_COMMUNITY_oms-client-import.service.ts]]
- 3 edges to [[_COMMUNITY_task-inventory-effects.service.ts]]
- 3 edges to [[_COMMUNITY_AuthController]]
- 2 edges to [[_COMMUNITY_warehouse-tasks.service.ts]]
- 2 edges to [[_COMMUNITY_dot-login]]
- 2 edges to [[_COMMUNITY_AuditLogsService]]
- 1 edge to [[_COMMUNITY_app.module.ts]]
- 1 edge to [[_COMMUNITY_returns.controller.ts]]
- 1 edge to [[_COMMUNITY_CreateInboundOrderDto]]
- 1 edge to [[_COMMUNITY_ListInboundQueryDto]]
- 1 edge to [[_COMMUNITY_variance.dto.ts]]
- 1 edge to [[_COMMUNITY_UpdateInboundPlanDto]]
- 1 edge to [[_COMMUNITY_OmsShippingScanService]]
- 1 edge to [[_COMMUNITY_testProductUpdateAuditHasBeforeAfter]]
- 1 edge to [[_COMMUNITY_BillingInvoiceCalculationService]]
- 1 edge to [[_COMMUNITY_client-oms-orders.service.ts]]
- 1 edge to [[_COMMUNITY_ClientPrincipal]]
- 1 edge to [[_COMMUNITY_inventory.service.ts]]
- 1 edge to [[_COMMUNITY_CurrentUser]]

## Top bridge nodes
- [[dot-fromPrincipal()]] - degree 52, connects to 19 communities
- [[dot-log()]] - degree 35, connects to 12 communities
- [[dot-create()_42]] - degree 22, connects to 11 communities
- [[InboundService]] - degree 39, connects to 10 communities
- [[dot-confirmAndDeduct()]] - degree 31, connects to 9 communities