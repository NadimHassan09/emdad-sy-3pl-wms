# OmsShippingScanService

> 15 nodes · cohesion 0.25

## Key Concepts

- **OmsShippingScanService** (15 connections) — `backend/src/modules/oms/oms-shipping-scan.service.ts`
- **.apply()** (11 connections) — `backend/src/modules/oms/oms-shipping-scan.service.ts`
- **.confirmHandover()** (6 connections) — `backend/src/modules/oms/oms-shipping-scan.service.ts`
- **.confirmReadyToShip()** (6 connections) — `backend/src/modules/oms/oms-shipping-scan.service.ts`
- **waybillScanAttempts()** (6 connections) — `backend/src/modules/shipping/shipping-lifecycle.util.ts`
- **OmsShippingScanAction** (4 connections) — `backend/src/modules/oms/dto/scan-shipping-transition.dto.ts`
- **.constructor()** (4 connections) — `backend/src/modules/oms/oms-shipping-scan.service.ts`
- **.findOrderForScan()** (4 connections) — `backend/src/modules/oms/oms-shipping-scan.service.ts`
- **.findShipmentByScan()** (4 connections) — `backend/src/modules/oms/oms-shipping-scan.service.ts`
- **.ok()** (4 connections) — `backend/src/modules/oms/oms-shipping-scan.service.ts`
- **.scanMatchesOrderOrActiveShipment()** (4 connections) — `backend/src/modules/oms/oms-shipping-scan.service.ts`
- **.assertProviderAssociation()** (3 connections) — `backend/src/modules/oms/oms-shipping-scan.service.ts`
- **shipmentScanValues()** (3 connections) — `backend/src/modules/shipping/shipping-lifecycle.util.ts`
- **Inject** (1 connections)
- **Injectable** (1 connections)

## Relationships

- [@prisma/client](@prisma-client.md) (8 shared connections)
- [shipping-tracking.service.ts](shipping-tracking.service.ts.md) (5 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (5 shared connections)
- [withTenantRls](withTenantRls.md) (2 shared connections)
- [@nestjs/common](@nestjs-common.md) (1 shared connections)
- [app.module.ts](app.module.ts.md) (1 shared connections)
- [CurrentUser](CurrentUser.md) (1 shared connections)
- [.fromPrincipal](fromPrincipal.md) (1 shared connections)

## Source Files

- `backend/src/modules/oms/dto/scan-shipping-transition.dto.ts`
- `backend/src/modules/oms/oms-shipping-scan.service.ts`
- `backend/src/modules/shipping/shipping-lifecycle.util.ts`

## Audit Trail

- EXTRACTED: 47 (94%)
- INFERRED: 3 (6%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*