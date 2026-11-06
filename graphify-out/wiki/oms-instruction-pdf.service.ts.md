# oms-instruction-pdf.service.ts

> 63 nodes · cohesion 0.09

## Key Concepts

- **oms-instruction-pdf.service.ts** (44 connections) — `backend/src/modules/oms/oms-instruction-pdf.service.ts`
- **oms-batch-instruction-sheet.ts** (22 connections) — `backend/src/modules/oms/oms-batch-instruction-sheet.ts`
- **oms-instruction-sheet.ts** (22 connections) — `backend/src/modules/oms/oms-instruction-sheet.ts`
- **.downloadBatch()** (18 connections) — `backend/src/modules/oms/oms-instruction-pdf.service.ts`
- **OmsInstructionPdfService** (17 connections) — `backend/src/modules/oms/oms-instruction-pdf.service.ts`
- **oms-batch-instruction.ts** (15 connections) — `backend/src/modules/oms/oms-batch-instruction.ts`
- **.loadSheet()** (14 connections) — `backend/src/modules/oms/oms-instruction-pdf.service.ts`
- **esc()** (11 connections) — `backend/src/modules/oms/oms-instruction-sheet.ts`
- **.renderHtml()** (10 connections) — `backend/src/pdf/pdf.service.ts`
- **buildBatchInstructionDocument()** (9 connections) — `backend/src/modules/oms/oms-batch-instruction.ts`
- **oms-batch-instruction.unit.spec.ts** (8 connections) — `backend/src/modules/oms/oms-batch-instruction.unit.spec.ts`
- **.downloadZip()** (8 connections) — `backend/src/modules/oms/oms-instruction-pdf.service.ts`
- **renderInstructionSheetsHtml()** (8 connections) — `backend/src/modules/oms/oms-instruction-sheet.ts`
- **locationBars()** (7 connections) — `backend/src/modules/oms/oms-batch-instruction-sheet.ts`
- **renderBatchInstructionHtml()** (7 connections) — `backend/src/modules/oms/oms-batch-instruction-sheet.ts`
- **.downloadOne()** (7 connections) — `backend/src/modules/oms/oms-instruction-pdf.service.ts`
- **.loadSheetsSorted()** (7 connections) — `backend/src/modules/oms/oms-instruction-pdf.service.ts`
- **icon()** (7 connections) — `backend/src/modules/oms/oms-instruction-sheet.ts`
- **oms-instruction-sheet.unit.spec.ts** (7 connections) — `backend/src/modules/oms/oms-instruction-sheet.unit.spec.ts`
- **renderBatchInstructionByKind()** (6 connections) — `backend/src/modules/oms/oms-batch-instruction-sheet.ts`
- **renderBatchPackingListHtml()** (6 connections) — `backend/src/modules/oms/oms-batch-instruction-sheet.ts`
- **renderBatchPickingListHtml()** (6 connections) — `backend/src/modules/oms/oms-batch-instruction-sheet.ts`
- **.downloadCombined()** (6 connections) — `backend/src/modules/oms/oms-instruction-pdf.service.ts`
- **compareOmsOrderNumbers()** (6 connections) — `backend/src/modules/oms/oms-instruction-sheet.ts`
- **safeInstructionFilename()** (6 connections) — `backend/src/modules/oms/oms-instruction-sheet.ts`
- *... and 38 more nodes in this community*

## Relationships

- [@prisma/client](@prisma-client.md) (9 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (7 shared connections)
- [.fromPrincipal](fromPrincipal.md) (7 shared connections)
- [PdfService](PdfService.md) (6 shared connections)
- [@nestjs/common](@nestjs-common.md) (5 shared connections)
- [oms-waybill.service.ts](oms-waybill.service.ts.md) (4 shared connections)
- [task-inventory-effects.service.ts](task-inventory-effects.service.ts.md) (3 shared connections)
- [withTenantRls](withTenantRls.md) (3 shared connections)
- [CurrentUser](CurrentUser.md) (3 shared connections)
- [oms/oms-operational-stage.ts](oms-oms-operational-stage.ts.md) (2 shared connections)
- [app.module.ts](app.module.ts.md) (2 shared connections)
- [OmsBatchMembershipDto](OmsBatchMembershipDto.md) (2 shared connections)

## Source Files

- `backend/src/modules/oms/oms-batch-instruction-sheet.ts`
- `backend/src/modules/oms/oms-batch-instruction.ts`
- `backend/src/modules/oms/oms-batch-instruction.unit.spec.ts`
- `backend/src/modules/oms/oms-instruction-pdf.service.ts`
- `backend/src/modules/oms/oms-instruction-sheet.ts`
- `backend/src/modules/oms/oms-instruction-sheet.unit.spec.ts`
- `backend/src/modules/oms/zip-buffers.ts`
- `backend/src/pdf/pdf.service.ts`

## Audit Trail

- EXTRACTED: 213 (94%)
- INFERRED: 14 (6%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*