# RealtimeService

> 110 nodes · cohesion 0.05

## Key Concepts

- **RealtimeService** (161 connections) — `backend/src/modules/realtime/realtime.service.ts`
- **realtime.service.ts** (69 connections) — `backend/src/modules/realtime/realtime.service.ts`
- **.notify()** (53 connections) — `backend/src/modules/realtime/realtime.service.ts`
- **.emit()** (41 connections) — `backend/src/modules/realtime/realtime.service.ts`
- **.scheduleDashboard()** (28 connections) — `backend/src/modules/realtime/realtime.service.ts`
- **.emitToRoom()** (23 connections) — `backend/src/modules/realtime/realtime.service.ts`
- **realtime.gateway.ts** (21 connections) — `backend/src/modules/realtime/realtime.gateway.ts`
- **realtime-socket-auth.ts** (18 connections) — `backend/src/modules/realtime/realtime-socket-auth.ts`
- **.emitInventoryChanged()** (14 connections) — `backend/src/modules/realtime/realtime.service.ts`
- **PresenceService** (13 connections) — `backend/src/modules/realtime/presence.service.ts`
- **.emitReturnEvent()** (13 connections) — `backend/src/modules/returns/returns.service.ts`
- **presence.service.ts** (12 connections) — `backend/src/modules/realtime/presence.service.ts`
- **RealtimeEventName** (9 connections) — `backend/src/modules/realtime/realtime.events.ts`
- **normalizeCompanyId()** (9 connections) — `backend/src/modules/realtime/realtime-socket-auth.ts`
- **DashboardRealtimeService** (8 connections) — `backend/src/modules/dashboard/dashboard-realtime.service.ts`
- **.flush()** (8 connections) — `backend/src/modules/dashboard/dashboard-realtime.service.ts`
- **RealtimeGateway** (8 connections) — `backend/src/modules/realtime/realtime.gateway.ts`
- **.emitCompanyLifecycleChanged()** (8 connections) — `backend/src/modules/realtime/realtime.service.ts`
- **.emitOutboundOrderCreated()** (8 connections) — `backend/src/modules/realtime/realtime.service.ts`
- **.emitPlanUpdated()** (8 connections) — `backend/src/modules/realtime/realtime.service.ts`
- **socket.io** (8 connections) — `backend/package.json`
- **.handleConnection()** (7 connections) — `backend/src/modules/realtime/realtime.gateway.ts`
- **.emitBillingRestrictionChanged()** (7 connections) — `backend/src/modules/realtime/realtime.service.ts`
- **.emitDashboard()** (7 connections) — `backend/src/modules/realtime/realtime.service.ts`
- **.emitDocumentGenerated()** (7 connections) — `backend/src/modules/realtime/realtime.service.ts`
- *... and 85 more nodes in this community*

## Relationships

- [@prisma/client](@prisma-client.md) (49 shared connections)
- [AuditLogService](AuditLogService.md) (21 shared connections)
- [app.module.ts](app.module.ts.md) (19 shared connections)
- [cycle-count.service.ts](cycle-count.service.ts.md) (12 shared connections)
- [NotificationsService](NotificationsService.md) (12 shared connections)
- [outbound.service.ts](outbound.service.ts.md) (11 shared connections)
- [EncryptionService](EncryptionService.md) (11 shared connections)
- [MutationQueueService](MutationQueueService.md) (10 shared connections)
- [grn-pdf.service.ts](grn-pdf.service.ts.md) (10 shared connections)
- [.fromPrincipal](fromPrincipal.md) (10 shared connections)
- [withTenantRls](withTenantRls.md) (10 shared connections)
- [dashboard.service.ts](dashboard.service.ts.md) (8 shared connections)

## Source Files

- `backend/package.json`
- `backend/src/modules/client-portal/notifications/client-notifications.service.ts`
- `backend/src/modules/dashboard/dashboard-realtime.service.ts`
- `backend/src/modules/forms/forms.service.ts`
- `backend/src/modules/locations/locations.service.ts`
- `backend/src/modules/observability/observability.service.ts`
- `backend/src/modules/realtime/presence.service.ts`
- `backend/src/modules/realtime/realtime-master-data.payload.ts`
- `backend/src/modules/realtime/realtime-registry.ts`
- `backend/src/modules/realtime/realtime-socket-auth.ts`
- `backend/src/modules/realtime/realtime.events.ts`
- `backend/src/modules/realtime/realtime.gateway.ts`
- `backend/src/modules/realtime/realtime.service.ts`
- `backend/src/modules/realtime/sync/realtime-sync-mode.service.ts`
- `backend/src/modules/returns/returns.service.ts`
- `backend/src/modules/shipping/bulk-shipping.service.ts`
- `backend/src/pdf/document-slot-overrides.service.ts`

## Audit Trail

- EXTRACTED: 523 (87%)
- INFERRED: 77 (13%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*