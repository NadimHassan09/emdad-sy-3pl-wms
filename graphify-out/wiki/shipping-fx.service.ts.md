# shipping-fx.service.ts

> 26 nodes · cohesion 0.12

## Key Concepts

- **shipping-fx.service.ts** (16 connections) — `backend/src/modules/shipping/shipping-fx.service.ts`
- **ShippingFxService** (15 connections) — `backend/src/modules/shipping/shipping-fx.service.ts`
- **UpsertShippingFxDto** (8 connections) — `backend/src/modules/shipping/dto/upsert-shipping-fx.dto.ts`
- **.saveFx()** (8 connections) — `backend/src/modules/shipping/shipping.controller.ts`
- **fx-source.ts** (7 connections) — `backend/src/modules/shipping/fx-source.ts`
- **fetchUsdToSypRate()** (5 connections) — `backend/src/modules/shipping/fx-source.ts`
- **.getSettings()** (5 connections) — `backend/src/modules/shipping/shipping-fx.service.ts`
- **.saveAutomatic()** (5 connections) — `backend/src/modules/shipping/shipping-fx.service.ts`
- **.saveManual()** (4 connections) — `backend/src/modules/shipping/shipping-fx.service.ts`
- **.testSource()** (4 connections) — `backend/src/modules/shipping/shipping-fx.service.ts`
- **.toView()** (4 connections) — `backend/src/modules/shipping/shipping-fx.service.ts`
- **.usableRate()** (4 connections) — `backend/src/modules/shipping/shipping-fx.service.ts`
- **FxFetchResult** (3 connections) — `backend/src/modules/shipping/fx-source.ts`
- **.refreshAutomatic()** (3 connections) — `backend/src/modules/shipping/shipping-fx.service.ts`
- **FX_AUTO_SOURCE** (2 connections) — `backend/src/modules/shipping/fx-source.ts`
- **FX_FRESH_MS** (2 connections) — `backend/src/modules/shipping/fx-source.ts`
- **FX_STALE_MS** (2 connections) — `backend/src/modules/shipping/fx-source.ts`
- **Put** (2 connections)
- **IsIn** (1 connections)
- **IsNumber** (1 connections)
- **IsOptional** (1 connections)
- **Min** (1 connections)
- **Type** (1 connections)
- **FX_AUTO_URL** (1 connections) — `backend/src/modules/shipping/fx-source.ts`
- **FxSettingsView** (1 connections) — `backend/src/modules/shipping/shipping-fx.service.ts`
- *... and 1 more nodes in this community*

## Relationships

- [ShippingController](ShippingController.md) (5 shared connections)
- [shipping.service.ts](shipping.service.ts.md) (4 shared connections)
- [shipping.controller.ts](shipping.controller.ts.md) (3 shared connections)
- [AuditLogService](AuditLogService.md) (3 shared connections)
- [@prisma/client](@prisma-client.md) (2 shared connections)
- [shipping.module.ts](shipping.module.ts.md) (2 shared connections)
- [EncryptionService](EncryptionService.md) (2 shared connections)
- [.assertCompanyAccess](assertCompanyAccess.md) (2 shared connections)
- [class-validator](class-validator.md) (1 shared connections)
- [CurrentUser](CurrentUser.md) (1 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (1 shared connections)
- [@nestjs/common](@nestjs-common.md) (1 shared connections)

## Source Files

- `backend/src/modules/shipping/dto/upsert-shipping-fx.dto.ts`
- `backend/src/modules/shipping/fx-source.ts`
- `backend/src/modules/shipping/shipping-fx.service.ts`
- `backend/src/modules/shipping/shipping.controller.ts`

## Audit Trail

- EXTRACTED: 59 (88%)
- INFERRED: 8 (12%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*