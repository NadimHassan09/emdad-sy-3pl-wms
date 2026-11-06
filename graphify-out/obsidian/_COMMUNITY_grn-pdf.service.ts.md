---
type: community
cohesion: 0.08
members: 76
---

# grn-pdf.service.ts

**Cohesion:** 0.08 - loosely connected
**Members:** 76 nodes

## Members
- [[dot-constructor()_175]] - code - backend/src/pdf/dn-pdf.service.ts
- [[dot-constructor()_176]] - code - backend/src/pdf/document-generation.service.ts
- [[dot-constructor()_177]] - code - backend/src/pdf/document-storage.service.ts
- [[dot-constructor()_178]] - code - backend/src/pdf/documents.controller.ts
- [[dot-constructor()_179]] - code - backend/src/pdf/final-contract-pdf.service.ts
- [[dot-constructor()_180]] - code - backend/src/pdf/grn-pdf.service.ts
- [[dot-constructor()_181]] - code - backend/src/pdf/invoice-pdf.service.ts
- [[dot-create()_23]] - code - backend/src/pdf/documents.service.ts
- [[dot-defaultLanguage()]] - code - backend/src/pdf/document-generation.service.ts
- [[dot-emitGenerated()]] - code - backend/src/pdf/grn-pdf.service.ts
- [[dot-findByReference()]] - code - backend/src/pdf/documents.service.ts
- [[dot-findByTask()]] - code - backend/src/pdf/documents.service.ts
- [[dot-generateDnForDispatch()]] - code - backend/src/pdf/document-generation.service.ts
- [[dot-generateForContract()]] - code - backend/src/pdf/final-contract-pdf.service.ts
- [[dot-generateForDispatchTask()]] - code - backend/src/pdf/dn-pdf.service.ts
- [[dot-generateForReceivingTask()]] - code - backend/src/pdf/grn-pdf.service.ts
- [[dot-generateGrnForReceiving()]] - code - backend/src/pdf/document-generation.service.ts
- [[dot-getForDownload()]] - code - backend/src/pdf/documents.service.ts
- [[dot-listForReference()_1]] - code - backend/src/pdf/documents.service.ts
- [[dot-nextNumber()]] - code - backend/src/pdf/documents.service.ts
- [[dot-refreshFile()]] - code - backend/src/pdf/documents.service.ts
- [[dot-render()]] - code - backend/src/modules/client-portal/external-api/api-docs.service.ts
- [[dot-render()_1]] - code - backend/src/pdf/pdf.service.ts
- [[dot-renderInvoicePdf()]] - code - backend/src/pdf/invoice-pdf.service.ts
- [[dot-replace()]] - code - backend/src/pdf/document-storage.service.ts
- [[dot-toResult()]] - code - backend/src/pdf/dn-pdf.service.ts
- [[dot-toResult()_1]] - code - backend/src/pdf/final-contract-pdf.service.ts
- [[dot-toResult()_2]] - code - backend/src/pdf/grn-pdf.service.ts
- [[dot-write()_1]] - code - backend/src/pdf/document-storage.service.ts
- [[DICT]] - code - backend/src/pdf/i18n.ts
- [[DOCUMENT_TABLE_MIN_ROWS]] - code - backend/src/pdf/pdf-table.util.ts
- [[DnPdfService]] - code - backend/src/pdf/dn-pdf.service.ts
- [[DocLang]] - code - backend/src/pdf/i18n.ts
- [[DocumentBranding]] - code - backend/src/pdf/branding.ts
- [[DocumentGenerationService]] - code - backend/src/pdf/document-generation.service.ts
- [[DocumentStorageService]] - code - backend/src/pdf/document-storage.service.ts
- [[DocumentsService]] - code - backend/src/pdf/documents.service.ts
- [[FinalContractPdfService]] - code - backend/src/pdf/final-contract-pdf.service.ts
- [[GenerateDocumentOptions]] - code - backend/src/pdf/grn-pdf.service.ts
- [[GeneratedDocumentResult]] - code - backend/src/pdf/grn-pdf.service.ts
- [[GrnPdfService]] - code - backend/src/pdf/grn-pdf.service.ts
- [[Injectable_116]] - code
- [[Injectable_117]] - code
- [[Injectable_118]] - code
- [[Injectable_119]] - code
- [[Injectable_120]] - code
- [[Injectable_121]] - code
- [[Injectable_122]] - code
- [[InvoicePdfService]] - code - backend/src/pdf/invoice-pdf.service.ts
- [[LINE_TYPE_LABELS_1]] - code - backend/src/pdf/invoice-pdf.service.ts
- [[LOCALE]] - code - backend/src/pdf/i18n.ts
- [[LabelKey]] - code - backend/src/pdf/i18n.ts
- [[RenderFooter]] - code - backend/src/pdf/pdf.service.ts
- [[StoredFile]] - code - backend/src/pdf/document-storage.service.ts
- [[barcode.util.ts]] - code - backend/src/pdf/barcode.util.ts
- [[barcodePngDataUri()]] - code - backend/src/pdf/barcode.util.ts
- [[brandContext()]] - code - backend/src/pdf/pdf-context.util.ts
- [[branding.ts]] - code - backend/src/pdf/branding.ts
- [[buildLabels()]] - code - backend/src/pdf/i18n.ts
- [[dn-pdf.service.ts]] - code - backend/src/pdf/dn-pdf.service.ts
- [[document-generation.service.ts]] - code - backend/src/pdf/document-generation.service.ts
- [[document-storage.service.ts]] - code - backend/src/pdf/document-storage.service.ts
- [[emptyTableRowSlots()]] - code - backend/src/pdf/pdf-table.util.ts
- [[footerContext()]] - code - backend/src/pdf/pdf-context.util.ts
- [[formatDocDate()]] - code - backend/src/pdf/i18n.ts
- [[formatDocDateTime()]] - code - backend/src/pdf/i18n.ts
- [[formatQty()_1]] - code - backend/src/pdf/i18n.ts
- [[grn-pdf.service.ts]] - code - backend/src/pdf/grn-pdf.service.ts
- [[i18n.ts]] - code - backend/src/pdf/i18n.ts
- [[invoice-pdf.service.ts]] - code - backend/src/pdf/invoice-pdf.service.ts
- [[makeTranslator()]] - code - backend/src/pdf/i18n.ts
- [[pdf-context.util.ts]] - code - backend/src/pdf/pdf-context.util.ts
- [[pdf-table.util.ts]] - code - backend/src/pdf/pdf-table.util.ts
- [[pdf.module.ts]] - code - backend/src/pdf/pdf.module.ts
- [[qrCodePngDataUri()]] - code - backend/src/pdf/barcode.util.ts
- [[resolveBranding()]] - code - backend/src/pdf/branding.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/grn-pdfservicets
SORT file.name ASC
```

## Connections to other communities
- 30 edges to [[_COMMUNITY_documents.controller.ts]]
- 29 edges to [[_COMMUNITY_PdfService]]
- 26 edges to [[_COMMUNITY_final-contract-pdf.service.ts]]
- 26 edges to [[_COMMUNITY_@prismaclient]]
- 11 edges to [[_COMMUNITY_app.module.ts]]
- 10 edges to [[_COMMUNITY_RealtimeService]]
- 7 edges to [[_COMMUNITY_@nestjscommon]]
- 4 edges to [[_COMMUNITY_cod-export.util.ts]]
- 2 edges to [[_COMMUNITY_warehouse-tasks.service.ts]]
- 2 edges to [[_COMMUNITY_AuthPrincipal]]
- 2 edges to [[_COMMUNITY_WarehouseTasksService]]
- 2 edges to [[_COMMUNITY_api-credentials.service.ts]]
- 2 edges to [[_COMMUNITY_ref_node_path]]
- 1 edge to [[_COMMUNITY_BillingInvoiceCalculationService]]
- 1 edge to [[_COMMUNITY_NotificationsService]]
- 1 edge to [[_COMMUNITY_dot-validateResourceOwnership]]
- 1 edge to [[_COMMUNITY_BillingController]]
- 1 edge to [[_COMMUNITY_backendpackage.json]]
- 1 edge to [[_COMMUNITY_reliability-test-helpers.ts]]

## Top bridge nodes
- [[grn-pdf.service.ts]] - degree 40, connects to 7 communities
- [[dn-pdf.service.ts]] - degree 39, connects to 6 communities
- [[pdf.module.ts]] - degree 28, connects to 6 communities
- [[document-storage.service.ts]] - degree 12, connects to 6 communities
- [[branding.ts]] - degree 11, connects to 5 communities