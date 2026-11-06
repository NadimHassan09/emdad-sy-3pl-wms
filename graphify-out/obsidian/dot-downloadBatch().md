---
source_file: "backend/src/modules/oms/oms-instruction-pdf.service.ts"
type: "code"
community: "oms-instruction-pdf.service.ts"
location: "L88"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/oms-instruction-pdfservicets
---

# .downloadBatch()

## Connections
- [[dot-downloadInstructions()]] - `calls` [INFERRED]
- [[dot-renderHtml()]] - `calls` [INFERRED]
- [[dot-resolveLocationPlace()]] - `calls` [EXTRACTED]
- [[dot-resolvePickSlices()]] - `calls` [EXTRACTED]
- [[dot-resolveWarehouseId()]] - `calls` [EXTRACTED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[BatchInstructionKind]] - `references` [EXTRACTED]
- [[OmsInstructionPdfService]] - `method` [EXTRACTED]
- [[batchInstructionFooterTemplate()]] - `calls` [EXTRACTED]
- [[buildBatchInstructionDocument()]] - `calls` [EXTRACTED]
- [[formatOrderDate()]] - `calls` [EXTRACTED]
- [[formatQty()_3]] - `calls` [EXTRACTED]
- [[outboundRequiresPacking()]] - `calls` [EXTRACTED]
- [[parseOutboundExecutionPlan()]] - `calls` [EXTRACTED]
- [[renderBatchInstructionByKind()]] - `calls` [EXTRACTED]
- [[safeInstructionFilename()]] - `calls` [EXTRACTED]
- [[toPlace()]] - `calls` [EXTRACTED]
- [[withTenantRls()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/oms-instruction-pdfservicets