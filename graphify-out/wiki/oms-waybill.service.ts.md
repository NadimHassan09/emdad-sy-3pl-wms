# oms-waybill.service.ts

> 39 nodes · cohesion 0.11

## Key Concepts

- **oms-waybill.service.ts** (39 connections) — `backend/src/modules/oms/oms-waybill.service.ts`
- **OmsWaybillService** (19 connections) — `backend/src/modules/oms/oms-waybill.service.ts`
- **extractSilaCarrierAwb()** (16 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-identifiers.ts`
- **sila-identifiers.ts** (15 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-identifiers.ts`
- **oms-order.types.ts** (11 connections) — `backend/src/modules/oms/oms-order.types.ts`
- **text()** (9 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-identifiers.ts`
- **.getWaybillData()** (8 connections) — `backend/src/modules/oms/oms-waybill.service.ts`
- **extractSilaProviderId()** (8 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-identifiers.ts`
- **isSilaPlatformIdentifier()** (8 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-identifiers.ts`
- **oms-waybill-layout.unit.spec.ts** (7 connections) — `backend/src/modules/oms/oms-waybill-layout.unit.spec.ts`
- **.generateWaybillPdf()** (7 connections) — `backend/src/modules/oms/oms-waybill.service.ts`
- **extractSilaCourier()** (7 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-identifiers.ts`
- **OmsWaybillData** (6 connections) — `backend/src/modules/oms/oms-order.types.ts`
- **.generateCombinedWaybillPdf()** (6 connections) — `backend/src/modules/oms/oms-waybill.service.ts`
- **.labelHtml()** (6 connections) — `backend/src/modules/oms/oms-waybill.service.ts`
- **.resolveCarrierAwb()** (6 connections) — `backend/src/modules/oms/oms-waybill.service.ts`
- **extractSilaApiLookupKeys()** (6 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-identifiers.ts`
- **oms-label-ready.ts** (5 connections) — `backend/src/modules/oms/oms-label-ready.ts`
- **.exportWaybillsExcel()** (5 connections) — `backend/src/modules/oms/oms-waybill.service.ts`
- **silaShipmentRow()** (5 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-identifiers.ts`
- **sila-identifiers.unit.spec.ts** (5 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-identifiers.unit.spec.ts`
- **shippingLabelReadiness()** (4 connections) — `backend/src/modules/oms/oms-label-ready.ts`
- **silaMatchKeys()** (4 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-identifiers.ts`
- **OmsOrderCreateExtras** (3 connections) — `backend/src/modules/oms/oms-order.types.ts`
- **omsOrderDataFromExtras()** (3 connections) — `backend/src/modules/oms/oms-order.types.ts`
- *... and 14 more nodes in this community*

## Relationships

- [shipping-tracking.service.ts](shipping-tracking.service.ts.md) (20 shared connections)
- [PdfService](PdfService.md) (9 shared connections)
- [sila-sy.adapter.ts](sila-sy.adapter.ts.md) (8 shared connections)
- [@prisma/client](@prisma-client.md) (6 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (5 shared connections)
- [@nestjs/common](@nestjs-common.md) (5 shared connections)
- [withTenantRls](withTenantRls.md) (4 shared connections)
- [oms-instruction-pdf.service.ts](oms-instruction-pdf.service.ts.md) (4 shared connections)
- [CurrentUser](CurrentUser.md) (4 shared connections)
- [outbound.service.ts](outbound.service.ts.md) (3 shared connections)
- [shipping-preflight.ts](shipping-preflight.ts.md) (2 shared connections)
- [shipping.module.ts](shipping.module.ts.md) (2 shared connections)

## Source Files

- `backend/src/modules/oms/oms-label-ready.ts`
- `backend/src/modules/oms/oms-label-ready.unit.spec.ts`
- `backend/src/modules/oms/oms-order.types.ts`
- `backend/src/modules/oms/oms-waybill-layout.unit.spec.ts`
- `backend/src/modules/oms/oms-waybill.service.ts`
- `backend/src/modules/shipping/providers/sila-sy/sila-identifiers.ts`
- `backend/src/modules/shipping/providers/sila-sy/sila-identifiers.unit.spec.ts`

## Audit Trail

- EXTRACTED: 155 (96%)
- INFERRED: 7 (4%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*