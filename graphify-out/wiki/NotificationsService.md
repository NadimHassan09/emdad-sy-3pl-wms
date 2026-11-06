# NotificationsService

> 67 nodes · cohesion 0.06

## Key Concepts

- **NotificationsService** (31 connections) — `backend/src/modules/notifications/notifications.service.ts`
- **notifications.service.ts** (29 connections) — `backend/src/modules/notifications/notifications.service.ts`
- **sla-escalation.service.ts** (21 connections) — `backend/src/modules/warehouse-workflow/sla-escalation.service.ts`
- **BillingNotificationsService** (20 connections) — `backend/src/modules/billing/billing-notifications.service.ts`
- **.processExpiredCycles()** (12 connections) — `backend/src/modules/billing/billing-cycle-processor.service.ts`
- **.constructor()** (12 connections) — `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`
- **notificationPayload()** (11 connections) — `backend/src/modules/realtime/realtime-activity.payload.ts`
- **sla-breach.util.ts** (11 connections) — `backend/src/modules/warehouse-workflow/sla-breach.util.ts`
- **.emitNotificationCreated()** (10 connections) — `backend/src/modules/realtime/realtime.service.ts`
- **sla-escalation.service.unit.spec.ts** (10 connections) — `backend/src/modules/warehouse-workflow/sla-escalation.service.unit.spec.ts`
- **SlaEscalationService** (9 connections) — `backend/src/modules/warehouse-workflow/sla-escalation.service.ts`
- **.createClientNotificationOnce()** (8 connections) — `backend/src/modules/billing/billing-notifications.service.ts`
- **.notifyAdminsOnce()** (8 connections) — `backend/src/modules/billing/billing-notifications.service.ts`
- **SlaAuditService** (8 connections) — `backend/src/modules/warehouse-workflow/sla-audit.service.ts`
- **isTaskSlaBreached()** (8 connections) — `backend/src/modules/warehouse-workflow/sla-breach.util.ts`
- **slaBreachDeadlineMs()** (8 connections) — `backend/src/modules/warehouse-workflow/sla-breach.util.ts`
- **BillingExpiryReminderService** (7 connections) — `backend/src/modules/billing/billing-expiry-reminder.service.ts`
- **.runTick()** (7 connections) — `backend/src/modules/warehouse-workflow/sla-escalation.service.ts`
- **sla-breach.util.unit.spec.ts** (6 connections) — `backend/src/modules/warehouse-workflow/sla-breach.util.unit.spec.ts`
- **.notifyAccountRenewed()** (5 connections) — `backend/src/modules/billing/billing-notifications.service.ts`
- **.createClientNotificationOnce()** (5 connections) — `backend/src/modules/notifications/notifications.service.ts`
- **.emitRecentAdminNotifications()** (5 connections) — `backend/src/modules/notifications/notifications.service.ts`
- **slaOverdueMinutes()** (5 connections) — `backend/src/modules/warehouse-workflow/sla-breach.util.ts`
- **.escalateTask()** (5 connections) — `backend/src/modules/warehouse-workflow/sla-escalation.service.ts`
- **.system()** (4 connections) — `backend/src/modules/billing/billing-audit.service.ts`
- *... and 42 more nodes in this community*

## Relationships

- [@prisma/client](@prisma-client.md) (43 shared connections)
- [RealtimeService](RealtimeService.md) (12 shared connections)
- [@nestjs/common](@nestjs-common.md) (9 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (7 shared connections)
- [BillingInvoiceCalculationService](BillingInvoiceCalculationService.md) (6 shared connections)
- [app.module.ts](app.module.ts.md) (6 shared connections)
- [warehouse-tasks.service.ts](warehouse-tasks.service.ts.md) (5 shared connections)
- [.fromPrincipal](fromPrincipal.md) (5 shared connections)
- [RedisService](RedisService.md) (4 shared connections)
- [outbound.service.ts](outbound.service.ts.md) (4 shared connections)
- [AuditLogService](AuditLogService.md) (4 shared connections)
- [task-inventory-effects.service.ts](task-inventory-effects.service.ts.md) (4 shared connections)

## Source Files

- `backend/src/modules/billing/billing-audit.service.ts`
- `backend/src/modules/billing/billing-cycle-processor.service.ts`
- `backend/src/modules/billing/billing-expiry-reminder.service.ts`
- `backend/src/modules/billing/billing-invoice-overdue-processor.service.ts`
- `backend/src/modules/billing/billing-notifications.service.ts`
- `backend/src/modules/client-portal/notifications/client-notifications.service.ts`
- `backend/src/modules/notifications/notifications.service.ts`
- `backend/src/modules/notifications/notifications.service.unit.spec.ts`
- `backend/src/modules/realtime/realtime-activity.payload.ts`
- `backend/src/modules/realtime/realtime.service.ts`
- `backend/src/modules/warehouse-workflow/sla-audit.service.ts`
- `backend/src/modules/warehouse-workflow/sla-breach.util.ts`
- `backend/src/modules/warehouse-workflow/sla-breach.util.unit.spec.ts`
- `backend/src/modules/warehouse-workflow/sla-escalation.service.ts`
- `backend/src/modules/warehouse-workflow/sla-escalation.service.unit.spec.ts`
- `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`

## Audit Trail

- EXTRACTED: 214 (86%)
- INFERRED: 34 (14%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*