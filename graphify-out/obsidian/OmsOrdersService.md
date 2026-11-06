---
source_file: "backend/src/modules/oms/oms-orders.service.ts"
type: "code"
community: "withTenantRls"
location: "L211"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/withTenantRls
---

# OmsOrdersService

## Connections
- [[dot-adjustShippingFee()_1]] - `method` [EXTRACTED]
- [[dot-allocate()_1]] - `method` [EXTRACTED]
- [[dot-allocateLinkedOutbound()]] - `method` [EXTRACTED]
- [[dot-approve()_7]] - `method` [EXTRACTED]
- [[dot-assertBillingAllowed()]] - `method` [EXTRACTED]
- [[dot-assertImportCreateReady()_1]] - `method` [EXTRACTED]
- [[dot-assertOutboundLinkable()]] - `method` [EXTRACTED]
- [[dot-assertSufficientStockForLines()]] - `method` [EXTRACTED]
- [[dot-buildListWhere()_5]] - `method` [EXTRACTED]
- [[dot-cancel()_13]] - `method` [EXTRACTED]
- [[dot-cancelShipment()_5]] - `method` [EXTRACTED]
- [[dot-cancelShipmentsBulk()_1]] - `method` [EXTRACTED]
- [[dot-collectCod()_1]] - `method` [EXTRACTED]
- [[dot-confirm()_9]] - `method` [EXTRACTED]
- [[dot-confirmReturnReceipt()_1]] - `method` [EXTRACTED]
- [[dot-constructor()_214]] - `references` [EXTRACTED]
- [[dot-constructor()_167]] - `references` [EXTRACTED]
- [[dot-constructor()_217]] - `references` [EXTRACTED]
- [[dot-constructor()_128]] - `references` [EXTRACTED]
- [[dot-constructor()_88]] - `references` [EXTRACTED]
- [[dot-constructor()_145]] - `references` [EXTRACTED]
- [[dot-constructor()_142]] - `method` [EXTRACTED]
- [[dot-create()_44]] - `method` [EXTRACTED]
- [[dot-delete()_1]] - `method` [EXTRACTED]
- [[dot-emitOms()]] - `method` [EXTRACTED]
- [[dot-findById()_15]] - `method` [EXTRACTED]
- [[dot-findExistingByExternalReference()]] - `method` [EXTRACTED]
- [[dot-findExistingByOrderNumber()]] - `method` [EXTRACTED]
- [[dot-findProductsBySkus()_2]] - `method` [EXTRACTED]
- [[dot-getShippingMovement()_1]] - `method` [EXTRACTED]
- [[dot-list()_54]] - `method` [EXTRACTED]
- [[dot-listForExport()_5]] - `method` [EXTRACTED]
- [[dot-markCompleted()]] - `method` [EXTRACTED]
- [[dot-markDelivered()]] - `method` [EXTRACTED]
- [[dot-markFailedDelivery()]] - `method` [EXTRACTED]
- [[dot-markOutForDelivery()]] - `method` [EXTRACTED]
- [[dot-markReturned()]] - `method` [EXTRACTED]
- [[dot-mirrorFromOutbound()]] - `method` [EXTRACTED]
- [[dot-recordExternalFulfillment()_1]] - `method` [EXTRACTED]
- [[dot-reject()_3]] - `method` [EXTRACTED]
- [[dot-releaseAllocation()_1]] - `method` [EXTRACTED]
- [[dot-resolveImportCompanyId()_1]] - `method` [EXTRACTED]
- [[dot-resolveOrder()]] - `method` [EXTRACTED]
- [[dot-revertCancel()_1]] - `method` [EXTRACTED]
- [[dot-revertDelivery()]] - `method` [EXTRACTED]
- [[dot-rollbackReturn()_2]] - `method` [EXTRACTED]
- [[dot-settleCod()_1]] - `method` [EXTRACTED]
- [[dot-statusNavCounts()_3]] - `method` [EXTRACTED]
- [[dot-timeline()_3]] - `method` [EXTRACTED]
- [[dot-transition()]] - `method` [EXTRACTED]
- [[dot-undoConfirmedReturn()_2]] - `method` [EXTRACTED]
- [[dot-update()_13]] - `method` [EXTRACTED]
- [[Injectable_152]] - `references` [EXTRACTED]
- [[client-oms-orders.service.ts]] - `imports` [EXTRACTED]
- [[oms-bulk.service.ts]] - `imports` [EXTRACTED]
- [[oms-bulk.service.unit.spec.ts]] - `imports` [EXTRACTED]
- [[oms-client-import.service.ts]] - `imports` [EXTRACTED]
- [[oms-orders-csv.service.ts]] - `imports` [EXTRACTED]
- [[oms-orders-stock-gate.unit.spec.ts]] - `imports` [EXTRACTED]
- [[oms-orders-validation-parity.unit.spec.ts]] - `imports` [EXTRACTED]
- [[oms-orders.service.ts]] - `contains` [EXTRACTED]
- [[oms-shipping-fee-adjustment.unit.spec.ts]] - `imports` [EXTRACTED]
- [[oms.controller.ts]] - `imports` [EXTRACTED]
- [[oms.module.ts]] - `imports` [EXTRACTED]
- [[outbound.service.ts]] - `imports` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/withTenantRls