# ReturnsService

> 43 nodes · cohesion 0.09

## Key Concepts

- **ReturnsService** (33 connections) — `backend/src/modules/returns/returns.service.ts`
- **.create()** (19 connections) — `backend/src/modules/returns/returns.service.ts`
- **ReturnsController** (16 connections) — `backend/src/modules/returns/returns.controller.ts`
- **ReturnQuantityValidation** (11 connections) — `backend/src/modules/returns/return-quantity.validation.ts`
- **.finalizeAfterOmsApproval()** (11 connections) — `backend/src/modules/returns/returns.service.ts`
- **Param** (10 connections)
- **Post** (9 connections)
- **.applyDisposition()** (8 connections) — `backend/src/modules/returns/returns.controller.ts`
- **.inspectLine()** (8 connections) — `backend/src/modules/returns/returns.controller.ts`
- **.receiveLine()** (8 connections) — `backend/src/modules/returns/returns.controller.ts`
- **.list()** (8 connections) — `backend/src/modules/returns/returns.service.ts`
- **.create()** (7 connections) — `backend/src/modules/returns/returns.controller.ts`
- **.getOutboundQuota()** (7 connections) — `backend/src/modules/returns/returns.controller.ts`
- **.list()** (7 connections) — `backend/src/modules/returns/returns.controller.ts`
- **.applyDisposition()** (7 connections) — `backend/src/modules/returns/returns.service.ts`
- **.assertWithinShippedLimits()** (6 connections) — `backend/src/modules/returns/return-quantity.validation.ts`
- **.cancel()** (6 connections) — `backend/src/modules/returns/returns.controller.ts`
- **.complete()** (6 connections) — `backend/src/modules/returns/returns.controller.ts`
- **.confirm()** (6 connections) — `backend/src/modules/returns/returns.controller.ts`
- **.findOne()** (6 connections) — `backend/src/modules/returns/returns.controller.ts`
- **.postInventory()** (6 connections) — `backend/src/modules/returns/returns.controller.ts`
- **.startReceiving()** (6 connections) — `backend/src/modules/returns/returns.controller.ts`
- **.getOutboundReturnQuota()** (6 connections) — `backend/src/modules/returns/returns.service.ts`
- **.client()** (5 connections) — `backend/src/modules/returns/return-quantity.validation.ts`
- **.getOutboundReturnQuota()** (4 connections) — `backend/src/modules/returns/return-quantity.validation.ts`
- *... and 18 more nodes in this community*

## Relationships

- [AuthPrincipal](AuthPrincipal.md) (17 shared connections)
- [returns.controller.ts](returns.controller.ts.md) (12 shared connections)
- [CurrentUser](CurrentUser.md) (12 shared connections)
- [.validateResourceOwnership](validateResourceOwnership.md) (12 shared connections)
- [.fromPrincipal](fromPrincipal.md) (11 shared connections)
- [returns.service.ts](returns.service.ts.md) (7 shared connections)
- [ClientPrincipal](ClientPrincipal.md) (4 shared connections)
- [@prisma/client](@prisma-client.md) (4 shared connections)
- [app.module.ts](app.module.ts.md) (3 shared connections)
- [AuditLogService](AuditLogService.md) (2 shared connections)
- [RealtimeService](RealtimeService.md) (2 shared connections)
- [outbound.service.ts](outbound.service.ts.md) (2 shared connections)

## Source Files

- `backend/src/modules/client-portal/returns/client-returns.service.ts`
- `backend/src/modules/returns/return-quantity.validation.ts`
- `backend/src/modules/returns/returns.controller.ts`
- `backend/src/modules/returns/returns.service.ts`

## Audit Trail

- EXTRACTED: 155 (86%)
- INFERRED: 25 (14%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*