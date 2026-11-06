---
type: community
cohesion: 0.09
members: 63
---

# oms-instruction-pdf.service.ts

**Cohesion:** 0.09 - loosely connected
**Members:** 63 nodes

## Members
- [[dot-constructor()_199]] - code - backend/src/modules/oms/oms-instruction-pdf.service.ts
- [[dot-downloadBatch()]] - code - backend/src/modules/oms/oms-instruction-pdf.service.ts
- [[dot-downloadCombined()]] - code - backend/src/modules/oms/oms-instruction-pdf.service.ts
- [[dot-downloadOne()]] - code - backend/src/modules/oms/oms-instruction-pdf.service.ts
- [[dot-downloadZip()]] - code - backend/src/modules/oms/oms-instruction-pdf.service.ts
- [[dot-loadSheet()]] - code - backend/src/modules/oms/oms-instruction-pdf.service.ts
- [[dot-loadSheetsSorted()]] - code - backend/src/modules/oms/oms-instruction-pdf.service.ts
- [[dot-renderHtml()]] - code - backend/src/pdf/pdf.service.ts
- [[dot-resolveLocationPlace()]] - code - backend/src/modules/oms/oms-instruction-pdf.service.ts
- [[dot-resolvePickSlices()]] - code - backend/src/modules/oms/oms-instruction-pdf.service.ts
- [[dot-resolveWarehouseId()]] - code - backend/src/modules/oms/oms-instruction-pdf.service.ts
- [[BatchInstructionDocument]] - code - backend/src/modules/oms/oms-batch-instruction.ts
- [[BatchInstructionKind]] - code - backend/src/modules/oms/oms-batch-instruction-sheet.ts
- [[BatchInstructionOrder]] - code - backend/src/modules/oms/oms-batch-instruction.ts
- [[BatchInstructionPick]] - code - backend/src/modules/oms/oms-batch-instruction.ts
- [[Injectable_139]] - code
- [[InstructionPickRow]] - code - backend/src/modules/oms/oms-instruction-sheet.ts
- [[InstructionPlace]] - code - backend/src/modules/oms/oms-instruction-sheet.ts
- [[InstructionSheet]] - code - backend/src/modules/oms/oms-instruction-sheet.ts
- [[OmsInstructionPdfService]] - code - backend/src/modules/oms/oms-instruction-pdf.service.ts
- [[PROCESSING_STATUSES]] - code - backend/src/modules/oms/oms-instruction-pdf.service.ts
- [[PickSlice]] - code - backend/src/modules/oms/oms-instruction-pdf.service.ts
- [[batchInstructionFooterTemplate()]] - code - backend/src/modules/oms/oms-batch-instruction-sheet.ts
- [[buildBatchInstructionDocument()]] - code - backend/src/modules/oms/oms-batch-instruction.ts
- [[codeBadge()]] - code - backend/src/modules/oms/oms-batch-instruction-sheet.ts
- [[codeBadge()_1]] - code - backend/src/modules/oms/oms-instruction-sheet.ts
- [[compareOmsOrderNumbers()]] - code - backend/src/modules/oms/oms-instruction-sheet.ts
- [[esc()_1]] - code - backend/src/modules/oms/oms-instruction-sheet.ts
- [[fontFace]] - code - backend/src/modules/oms/oms-instruction-sheet.ts
- [[formatOrderDate()]] - code - backend/src/modules/oms/oms-instruction-pdf.service.ts
- [[formatQty()_2]] - code - backend/src/modules/oms/oms-batch-instruction.ts
- [[formatQty()_3]] - code - backend/src/modules/oms/oms-instruction-pdf.service.ts
- [[icon()]] - code - backend/src/modules/oms/oms-instruction-sheet.ts
- [[locationBars()]] - code - backend/src/modules/oms/oms-batch-instruction-sheet.ts
- [[logoDataUri]] - code - backend/src/modules/oms/oms-instruction-sheet.ts
- [[mastHeader()]] - code - backend/src/modules/oms/oms-batch-instruction-sheet.ts
- [[oms-batch-instruction-sheet.ts]] - code - backend/src/modules/oms/oms-batch-instruction-sheet.ts
- [[oms-batch-instruction.ts]] - code - backend/src/modules/oms/oms-batch-instruction.ts
- [[oms-batch-instruction.unit.spec.ts]] - code - backend/src/modules/oms/oms-batch-instruction.unit.spec.ts
- [[oms-instruction-pdf.service.ts]] - code - backend/src/modules/oms/oms-instruction-pdf.service.ts
- [[oms-instruction-sheet.ts]] - code - backend/src/modules/oms/oms-instruction-sheet.ts
- [[oms-instruction-sheet.unit.spec.ts]] - code - backend/src/modules/oms/oms-instruction-sheet.unit.spec.ts
- [[placeKey()]] - code - backend/src/modules/oms/oms-batch-instruction.ts
- [[placeMissing()]] - code - backend/src/modules/oms/oms-batch-instruction-sheet.ts
- [[placeValue()]] - code - backend/src/modules/oms/oms-batch-instruction-sheet.ts
- [[placeValue()_1]] - code - backend/src/modules/oms/oms-instruction-sheet.ts
- [[productKey()]] - code - backend/src/modules/oms/oms-batch-instruction.ts
- [[qty()]] - code - backend/src/modules/oms/oms-batch-instruction.ts
- [[readDataUri()]] - code - backend/src/modules/oms/oms-instruction-sheet.ts
- [[readTaskReservations()]] - code - backend/src/modules/oms/oms-instruction-pdf.service.ts
- [[ref_node_zlib]] - concept
- [[renderBatchInstructionByKind()]] - code - backend/src/modules/oms/oms-batch-instruction-sheet.ts
- [[renderBatchInstructionHtml()]] - code - backend/src/modules/oms/oms-batch-instruction-sheet.ts
- [[renderBatchPackingListHtml()]] - code - backend/src/modules/oms/oms-batch-instruction-sheet.ts
- [[renderBatchPickingListHtml()]] - code - backend/src/modules/oms/oms-batch-instruction-sheet.ts
- [[renderInstructionSheetsHtml()]] - code - backend/src/modules/oms/oms-instruction-sheet.ts
- [[safeInstructionFilename()]] - code - backend/src/modules/oms/oms-instruction-sheet.ts
- [[same()]] - code - backend/src/modules/oms/oms-batch-instruction.unit.spec.ts
- [[sharedStyles()]] - code - backend/src/modules/oms/oms-batch-instruction-sheet.ts
- [[sheetHtml()]] - code - backend/src/modules/oms/oms-instruction-sheet.ts
- [[toPlace()]] - code - backend/src/modules/oms/oms-instruction-pdf.service.ts
- [[zip-buffers.ts]] - code - backend/src/modules/oms/zip-buffers.ts
- [[zipBuffers()]] - code - backend/src/modules/oms/zip-buffers.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/oms-instruction-pdfservicets
SORT file.name ASC
```

## Connections to other communities
- 9 edges to [[_COMMUNITY_@prismaclient]]
- 7 edges to [[_COMMUNITY_AuthPrincipal]]
- 7 edges to [[_COMMUNITY_dot-fromPrincipal]]
- 6 edges to [[_COMMUNITY_PdfService]]
- 5 edges to [[_COMMUNITY_@nestjscommon]]
- 4 edges to [[_COMMUNITY_oms-waybill.service.ts]]
- 3 edges to [[_COMMUNITY_CurrentUser]]
- 3 edges to [[_COMMUNITY_task-inventory-effects.service.ts]]
- 3 edges to [[_COMMUNITY_withTenantRls]]
- 2 edges to [[_COMMUNITY_app.module.ts]]
- 2 edges to [[_COMMUNITY_OmsBatchMembershipDto]]
- 2 edges to [[_COMMUNITY_cod-export.util.ts]]
- 2 edges to [[_COMMUNITY_omsoms-operational-stage.ts]]
- 2 edges to [[_COMMUNITY_ref_node_path]]
- 1 edge to [[_COMMUNITY_outbound.service.ts]]

## Top bridge nodes
- [[oms-instruction-pdf.service.ts]] - degree 44, connects to 10 communities
- [[dot-downloadBatch()]] - degree 18, connects to 4 communities
- [[OmsInstructionPdfService]] - degree 17, connects to 4 communities
- [[dot-loadSheet()]] - degree 14, connects to 3 communities
- [[dot-renderHtml()]] - degree 10, connects to 3 communities