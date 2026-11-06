---
source_file: "backend/src/modules/shipping/shipment-parts.util.ts"
type: "code"
community: "shipping.service.ts"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/shippingservicets
---

# shipment-parts.util.ts

## Connections
- [[OrderLineForParts]] - `contains` [EXTRACTED]
- [[PhysicalShipmentPart]] - `contains` [EXTRACTED]
- [[ShippingCarton]] - `imports` [EXTRACTED]
- [[babelPartsFromCartons()]] - `contains` [EXTRACTED]
- [[buildPhysicalShipmentParts()]] - `contains` [EXTRACTED]
- [[cartonWeightKg()]] - `contains` [EXTRACTED]
- [[shipping-cartons.types.ts]] - `imports_from` [EXTRACTED]
- [[shipping.service.ts]] - `imports_from` [EXTRACTED]
- [[toBabelWeightParts()]] - `contains` [EXTRACTED]
- [[totalCartonsVolumeCbm()]] - `contains` [EXTRACTED]
- [[totalCartonsWeightKg()]] - `contains` [EXTRACTED]
- [[totalWeightKg()]] - `contains` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/shippingservicets