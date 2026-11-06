# bulk-shipping.service.ts

> 38 nodes · cohesion 0.11

## Key Concepts

- **bulk-shipping.service.ts** (27 connections) — `backend/src/modules/shipping/bulk-shipping.service.ts`
- **bulk-shipping.eligibility.ts** (18 connections) — `backend/src/modules/shipping/bulk-shipping.eligibility.ts`
- **currency-conversion.ts** (13 connections) — `backend/src/modules/shipping/currency-conversion.ts`
- **shipping-rate.util.ts** (11 connections) — `backend/src/modules/shipping/shipping-rate.util.ts`
- **comparableValueUsd()** (8 connections) — `backend/src/modules/shipping/currency-conversion.ts`
- **currency-conversion.unit.spec.ts** (8 connections) — `backend/src/modules/shipping/currency-conversion.unit.spec.ts`
- **bulk-shipping.eligibility.unit.spec.ts** (7 connections) — `backend/src/modules/shipping/bulk-shipping.eligibility.unit.spec.ts`
- **getFxRateSnapshot()** (7 connections) — `backend/src/modules/shipping/currency-conversion.ts`
- **annotateRateQuotes()** (7 connections) — `backend/src/modules/shipping/shipping-rate.util.ts`
- **isEligibleForBulkShipping()** (6 connections) — `backend/src/modules/shipping/bulk-shipping.eligibility.ts`
- **bulk-shipping.selection.ts** (6 connections) — `backend/src/modules/shipping/bulk-shipping.selection.ts`
- **recommendCheapestProvider()** (5 connections) — `backend/src/modules/shipping/bulk-shipping.eligibility.ts`
- **effectiveComparableCost()** (5 connections) — `backend/src/modules/shipping/currency-conversion.ts`
- **toComparableUsd()** (5 connections) — `backend/src/modules/shipping/currency-conversion.ts`
- **resolveBulkProviderSelection()** (4 connections) — `backend/src/modules/shipping/bulk-shipping.eligibility.ts`
- **bulkSelectionPatch()** (4 connections) — `backend/src/modules/shipping/bulk-shipping.selection.ts`
- **bulk-shipping.selection.unit.spec.ts** (4 connections) — `backend/src/modules/shipping/bulk-shipping.selection.unit.spec.ts`
- **MANUAL_SHIPPING_CODE** (4 connections) — `backend/src/modules/shipping/shipping.constants.ts`
- **BulkSelectionPatch** (3 connections) — `backend/src/modules/shipping/bulk-shipping.selection.ts`
- **FxRateSnapshot** (3 connections) — `backend/src/modules/shipping/currency-conversion.ts`
- **ShippingRateQuote** (3 connections) — `backend/src/modules/shipping/shipping-rate.util.ts`
- **shipping-rate.util.unit.spec.ts** (3 connections) — `backend/src/modules/shipping/shipping-rate.util.unit.spec.ts`
- **getUsdToSypRate()** (2 connections) — `backend/src/modules/shipping/bulk-shipping.eligibility.ts`
- **normalizePriceForComparison()** (2 connections) — `backend/src/modules/shipping/bulk-shipping.eligibility.ts`
- **FX_FALLBACK_USD_TO_SYP** (2 connections) — `backend/src/modules/shipping/currency-conversion.ts`
- *... and 13 more nodes in this community*

## Relationships

- [shipping.service.ts](shipping.service.ts.md) (14 shared connections)
- [@prisma/client](@prisma-client.md) (7 shared connections)
- [shipping.module.ts](shipping.module.ts.md) (7 shared connections)
- [RealtimeService](RealtimeService.md) (2 shared connections)
- [EncryptionService](EncryptionService.md) (1 shared connections)
- [ShippingController](ShippingController.md) (1 shared connections)
- [@nestjs/common](@nestjs-common.md) (1 shared connections)
- [class-validator](class-validator.md) (1 shared connections)
- [shipping.controller.ts](shipping.controller.ts.md) (1 shared connections)

## Source Files

- `backend/src/modules/shipping/bulk-shipping.eligibility.ts`
- `backend/src/modules/shipping/bulk-shipping.eligibility.unit.spec.ts`
- `backend/src/modules/shipping/bulk-shipping.selection.ts`
- `backend/src/modules/shipping/bulk-shipping.selection.unit.spec.ts`
- `backend/src/modules/shipping/bulk-shipping.service.ts`
- `backend/src/modules/shipping/currency-conversion.ts`
- `backend/src/modules/shipping/currency-conversion.unit.spec.ts`
- `backend/src/modules/shipping/shipping-rate.util.ts`
- `backend/src/modules/shipping/shipping-rate.util.unit.spec.ts`
- `backend/src/modules/shipping/shipping.constants.ts`

## Audit Trail

- EXTRACTED: 110 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*