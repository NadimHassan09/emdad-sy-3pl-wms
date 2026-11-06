---
type: community
cohesion: 0.11
members: 39
---

# oms-waybill.service.ts

**Cohesion:** 0.11 - loosely connected
**Members:** 39 nodes

## Members
- [[dot-constructor()_239]] - code - backend/src/modules/oms/oms-waybill.service.ts
- [[dot-exportWaybillsExcel()_1]] - code - backend/src/modules/oms/oms-waybill.service.ts
- [[dot-generateCombinedWaybillPdf()]] - code - backend/src/modules/oms/oms-waybill.service.ts
- [[dot-generateWaybillPdf()]] - code - backend/src/modules/oms/oms-waybill.service.ts
- [[dot-getWaybillData()]] - code - backend/src/modules/oms/oms-waybill.service.ts
- [[dot-labelHtml()]] - code - backend/src/modules/oms/oms-waybill.service.ts
- [[dot-resolveBabelParts()]] - code - backend/src/modules/oms/oms-waybill.service.ts
- [[dot-resolveCarrierAwb()]] - code - backend/src/modules/oms/oms-waybill.service.ts
- [[CONFIRMED]] - code - backend/src/modules/oms/oms-label-ready.ts
- [[Injectable_176]] - code
- [[LabelReadiness]] - code - backend/src/modules/oms/oms-label-ready.ts
- [[OmsOrderCreateExtras]] - code - backend/src/modules/oms/oms-order.types.ts
- [[OmsOrderLineExtras]] - code - backend/src/modules/oms/oms-order.types.ts
- [[OmsWaybillData_1]] - code - backend/src/modules/oms/oms-order.types.ts
- [[OmsWaybillItem]] - code - backend/src/modules/oms/oms-order.types.ts
- [[OmsWaybillPartInfo]] - code - backend/src/modules/oms/oms-order.types.ts
- [[OmsWaybillService]] - code - backend/src/modules/oms/oms-waybill.service.ts
- [[QRCode_1]] - code - backend/src/modules/oms/oms-waybill.service.ts
- [[extractSilaApiLookupKeys()]] - code - backend/src/modules/shipping/providers/sila-sy/sila-identifiers.ts
- [[extractSilaCarrierAwb()]] - code - backend/src/modules/shipping/providers/sila-sy/sila-identifiers.ts
- [[extractSilaCourier()]] - code - backend/src/modules/shipping/providers/sila-sy/sila-identifiers.ts
- [[extractSilaProviderId()]] - code - backend/src/modules/shipping/providers/sila-sy/sila-identifiers.ts
- [[fixture()]] - code - backend/src/modules/oms/oms-waybill-layout.unit.spec.ts
- [[isSilaPlatformIdentifier()]] - code - backend/src/modules/shipping/providers/sila-sy/sila-identifiers.ts
- [[nestedId()]] - code - backend/src/modules/shipping/providers/sila-sy/sila-identifiers.ts
- [[nestedName()]] - code - backend/src/modules/shipping/providers/sila-sy/sila-identifiers.ts
- [[oms-label-ready.ts]] - code - backend/src/modules/oms/oms-label-ready.ts
- [[oms-label-ready.unit.spec.ts]] - code - backend/src/modules/oms/oms-label-ready.unit.spec.ts
- [[oms-order.types.ts]] - code - backend/src/modules/oms/oms-order.types.ts
- [[oms-waybill-layout.unit.spec.ts]] - code - backend/src/modules/oms/oms-waybill-layout.unit.spec.ts
- [[oms-waybill.service.ts]] - code - backend/src/modules/oms/oms-waybill.service.ts
- [[omsOrderDataFromExtras()]] - code - backend/src/modules/oms/oms-order.types.ts
- [[qrCodePngDataUri()_1]] - code - backend/src/modules/oms/oms-waybill.service.ts
- [[shippingLabelReadiness()]] - code - backend/src/modules/oms/oms-label-ready.ts
- [[sila-identifiers.ts]] - code - backend/src/modules/shipping/providers/sila-sy/sila-identifiers.ts
- [[sila-identifiers.unit.spec.ts]] - code - backend/src/modules/shipping/providers/sila-sy/sila-identifiers.unit.spec.ts
- [[silaMatchKeys()]] - code - backend/src/modules/shipping/providers/sila-sy/sila-identifiers.ts
- [[silaShipmentRow()]] - code - backend/src/modules/shipping/providers/sila-sy/sila-identifiers.ts
- [[text()_3]] - code - backend/src/modules/shipping/providers/sila-sy/sila-identifiers.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/oms-waybillservicets
SORT file.name ASC
```

## Connections to other communities
- 20 edges to [[_COMMUNITY_shipping-tracking.service.ts]]
- 9 edges to [[_COMMUNITY_PdfService]]
- 8 edges to [[_COMMUNITY_sila-sy.adapter.ts]]
- 6 edges to [[_COMMUNITY_@prismaclient]]
- 5 edges to [[_COMMUNITY_@nestjscommon]]
- 5 edges to [[_COMMUNITY_AuthPrincipal]]
- 4 edges to [[_COMMUNITY_withTenantRls]]
- 4 edges to [[_COMMUNITY_CurrentUser]]
- 4 edges to [[_COMMUNITY_oms-instruction-pdf.service.ts]]
- 3 edges to [[_COMMUNITY_outbound.service.ts]]
- 2 edges to [[_COMMUNITY_app.module.ts]]
- 2 edges to [[_COMMUNITY_OmsBatchMembershipDto]]
- 2 edges to [[_COMMUNITY_shipping.module.ts]]
- 2 edges to [[_COMMUNITY_backendpackage.json]]
- 2 edges to [[_COMMUNITY_shipping-preflight.ts]]
- 1 edge to [[_COMMUNITY_backup-gdrive-e2e-cert.mjs]]
- 1 edge to [[_COMMUNITY_ref_node_path]]
- 1 edge to [[_COMMUNITY_OmsOrdersListPage.tsx]]

## Top bridge nodes
- [[oms-waybill.service.ts]] - degree 39, connects to 12 communities
- [[OmsWaybillService]] - degree 19, connects to 6 communities
- [[oms-order.types.ts]] - degree 11, connects to 3 communities
- [[dot-getWaybillData()]] - degree 8, connects to 3 communities
- [[dot-generateWaybillPdf()]] - degree 7, connects to 3 communities