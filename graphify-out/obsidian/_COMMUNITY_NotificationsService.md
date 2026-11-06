---
type: community
cohesion: 0.06
members: 67
---

# NotificationsService

**Cohesion:** 0.06 - loosely connected
**Members:** 67 nodes

## Members
- [[dot-constructor()_195]] - code - backend/src/modules/billing/billing-notifications.service.ts
- [[dot-constructor()_196]] - code - backend/src/modules/notifications/notifications.service.ts
- [[dot-constructor()_197]] - code - backend/src/modules/warehouse-workflow/sla-audit.service.ts
- [[dot-constructor()_198]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-createClientNotificationOnce()]] - code - backend/src/modules/billing/billing-notifications.service.ts
- [[dot-createClientNotificationOnce()_1]] - code - backend/src/modules/notifications/notifications.service.ts
- [[dot-emitNotificationCreated()]] - code - backend/src/modules/realtime/realtime.service.ts
- [[dot-emitRecentAdminNotifications()]] - code - backend/src/modules/notifications/notifications.service.ts
- [[dot-escalateTask()]] - code - backend/src/modules/warehouse-workflow/sla-escalation.service.ts
- [[dot-escalated()]] - code - backend/src/modules/warehouse-workflow/sla-audit.service.ts
- [[dot-expiryReminderDays()]] - code - backend/src/modules/billing/billing-notifications.service.ts
- [[dot-notifyAccountRenewed()]] - code - backend/src/modules/billing/billing-notifications.service.ts
- [[dot-notifyAccountSuspended()]] - code - backend/src/modules/billing/billing-notifications.service.ts
- [[dot-notifyAdminsClientProductAdded()]] - code - backend/src/modules/notifications/notifications.service.ts
- [[dot-notifyAdminsOnce()]] - code - backend/src/modules/billing/billing-notifications.service.ts
- [[dot-notifyAdminsPendingApproval()]] - code - backend/src/modules/notifications/notifications.service.ts
- [[dot-notifyClientOrderCompleted()]] - code - backend/src/modules/notifications/notifications.service.ts
- [[dot-notifyCompany()]] - code - backend/src/modules/client-portal/notifications/client-notifications.service.ts
- [[dot-notifyCycleExpiring()]] - code - backend/src/modules/billing/billing-notifications.service.ts
- [[dot-notifyInvoiceGenerated()]] - code - backend/src/modules/billing/billing-notifications.service.ts
- [[dot-notifyInvoiceOverdue()]] - code - backend/src/modules/billing/billing-notifications.service.ts
- [[dot-notifyManagersSlaBreach()]] - code - backend/src/modules/notifications/notifications.service.ts
- [[dot-processExpiredCycles()]] - code - backend/src/modules/billing/billing-cycle-processor.service.ts
- [[dot-processOverdueInvoices()]] - code - backend/src/modules/billing/billing-invoice-overdue-processor.service.ts
- [[dot-runTick()_2]] - code - backend/src/modules/billing/billing-cycle-processor.service.ts
- [[dot-runTick()_3]] - code - backend/src/modules/billing/billing-expiry-reminder.service.ts
- [[dot-runTick()_4]] - code - backend/src/modules/billing/billing-invoice-overdue-processor.service.ts
- [[dot-runTick()_5]] - code - backend/src/modules/warehouse-workflow/sla-escalation.service.ts
- [[dot-sendDueReminders()]] - code - backend/src/modules/billing/billing-expiry-reminder.service.ts
- [[dot-system()]] - code - backend/src/modules/billing/billing-audit.service.ts
- [[dot-tick()_2]] - code - backend/src/modules/billing/billing-cycle-processor.service.ts
- [[dot-tick()_3]] - code - backend/src/modules/billing/billing-expiry-reminder.service.ts
- [[dot-tick()_4]] - code - backend/src/modules/billing/billing-invoice-overdue-processor.service.ts
- [[dot-tick()_5]] - code - backend/src/modules/warehouse-workflow/sla-escalation.service.ts
- [[ADMIN_NOTIFY_ROLES_1]] - code - backend/src/modules/notifications/notifications.service.ts
- [[BillingExpiryReminderService]] - code - backend/src/modules/billing/billing-expiry-reminder.service.ts
- [[BillingNotificationsService]] - code - backend/src/modules/billing/billing-notifications.service.ts
- [[Cron_3]] - code
- [[Cron_4]] - code
- [[Cron_5]] - code
- [[Cron_6]] - code
- [[EscalationOutcome]] - code - backend/src/modules/warehouse-workflow/sla-escalation.service.ts
- [[IN_APP_CHANNELS]] - code - backend/src/modules/notifications/notifications.service.ts
- [[Injectable_134]] - code
- [[Injectable_135]] - code
- [[Injectable_136]] - code
- [[Injectable_137]] - code
- [[Injectable_138]] - code
- [[NotificationDto]] - code - backend/src/modules/notifications/notifications.service.ts
- [[NotificationsService]] - code - backend/src/modules/notifications/notifications.service.ts
- [[SLA_ESCALATION_COOLDOWN_MS]] - code - backend/src/modules/warehouse-workflow/sla-breach.util.ts
- [[SLA_MANAGER_NOTIFY_ROLES]] - code - backend/src/modules/notifications/notifications.service.ts
- [[SlaAuditService]] - code - backend/src/modules/warehouse-workflow/sla-audit.service.ts
- [[SlaEscalationService]] - code - backend/src/modules/warehouse-workflow/sla-escalation.service.ts
- [[TASK_TYPE_LABELS]] - code - backend/src/modules/warehouse-workflow/sla-breach.util.ts
- [[buildService()_9]] - code - backend/src/modules/warehouse-workflow/sla-escalation.service.unit.spec.ts
- [[isTaskSlaBreached()]] - code - backend/src/modules/warehouse-workflow/sla-breach.util.ts
- [[notificationPayload()]] - code - backend/src/modules/realtime/realtime-activity.payload.ts
- [[notifications.service.ts]] - code - backend/src/modules/notifications/notifications.service.ts
- [[notifications.service.unit.spec.ts]] - code - backend/src/modules/notifications/notifications.service.unit.spec.ts
- [[sla-breach.util.ts]] - code - backend/src/modules/warehouse-workflow/sla-breach.util.ts
- [[sla-breach.util.unit.spec.ts]] - code - backend/src/modules/warehouse-workflow/sla-breach.util.unit.spec.ts
- [[sla-escalation.service.ts]] - code - backend/src/modules/warehouse-workflow/sla-escalation.service.ts
- [[sla-escalation.service.unit.spec.ts]] - code - backend/src/modules/warehouse-workflow/sla-escalation.service.unit.spec.ts
- [[slaBreachDeadlineMs()]] - code - backend/src/modules/warehouse-workflow/sla-breach.util.ts
- [[slaOverdueMinutes()]] - code - backend/src/modules/warehouse-workflow/sla-breach.util.ts
- [[slaTaskTypeLabel()]] - code - backend/src/modules/warehouse-workflow/sla-breach.util.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/NotificationsService
SORT file.name ASC
```

## Connections to other communities
- 43 edges to [[_COMMUNITY_@prismaclient]]
- 12 edges to [[_COMMUNITY_RealtimeService]]
- 9 edges to [[_COMMUNITY_@nestjscommon]]
- 7 edges to [[_COMMUNITY_AuthPrincipal]]
- 6 edges to [[_COMMUNITY_BillingInvoiceCalculationService]]
- 6 edges to [[_COMMUNITY_app.module.ts]]
- 5 edges to [[_COMMUNITY_warehouse-tasks.service.ts]]
- 5 edges to [[_COMMUNITY_dot-fromPrincipal]]
- 4 edges to [[_COMMUNITY_task-inventory-effects.service.ts]]
- 4 edges to [[_COMMUNITY_AuditLogService]]
- 4 edges to [[_COMMUNITY_outbound.service.ts]]
- 4 edges to [[_COMMUNITY_RedisService]]
- 2 edges to [[_COMMUNITY_WarehouseTasksService]]
- 2 edges to [[_COMMUNITY_ClientNotificationsService]]
- 2 edges to [[_COMMUNITY_reliability-test-helpers.ts]]
- 2 edges to [[_COMMUNITY_RunReportQueryDto]]
- 2 edges to [[_COMMUNITY_dot-assertCompanyAccess]]
- 1 edge to [[_COMMUNITY_TaskReadCacheService]]
- 1 edge to [[_COMMUNITY_grn-pdf.service.ts]]
- 1 edge to [[_COMMUNITY_inventory.service.ts]]
- 1 edge to [[_COMMUNITY_CacheInvalidationService]]
- 1 edge to [[_COMMUNITY_ClientPrincipal]]
- 1 edge to [[_COMMUNITY_withTenantRls]]

## Top bridge nodes
- [[dot-constructor()_198]] - degree 12, connects to 10 communities
- [[NotificationsService]] - degree 31, connects to 9 communities
- [[notifications.service.ts]] - degree 29, connects to 9 communities
- [[notificationPayload()]] - degree 11, connects to 4 communities
- [[sla-escalation.service.ts]] - degree 21, connects to 3 communities