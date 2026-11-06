---
type: community
cohesion: 0.09
members: 63
---

# ReceivingExecutionPanel.tsx

**Cohesion:** 0.09 - loosely connected
**Members:** 63 nodes

## Members
- [[DEFAULT_RECEIVING_LINE_FILTERS]] - code - frontend/src/pages/tasks/receiving/receiving-types.ts
- [[InboundOrderLine]] - code - frontend/src/api/inbound.ts
- [[LineReceiveDraft]] - code - frontend/src/pages/tasks/receiving/receiving-types.ts
- [[MatchedLine]] - code - frontend/src/pages/tasks/receiving/receiving-types.ts
- [[ProductAttributeDraft]] - code - frontend/src/pages/tasks/receiving/receiving-types.ts
- [[ProductLot]] - code - frontend/src/api/products.ts
- [[Props_57]] - code - frontend/src/pages/tasks/receiving/ReceivingExecutionPanel.tsx
- [[ReceivingExecutionDraft]] - code - frontend/src/pages/tasks/receiving/receiving-types.ts
- [[ReceivingExecutionPanel()]] - code - frontend/src/pages/tasks/receiving/ReceivingExecutionPanel.tsx
- [[ReceivingExecutionPanel.tsx]] - code - frontend/src/pages/tasks/receiving/ReceivingExecutionPanel.tsx
- [[ReceivingLineActionsMenu()]] - code - frontend/src/pages/tasks/receiving/ReceivingExecutionPanel.tsx
- [[ReceivingLineFilters]] - code - frontend/src/pages/tasks/receiving/receiving-types.ts
- [[ReceivingLineRow]] - code - frontend/src/pages/tasks/receiving/receiving-types.ts
- [[ReceivingLineStatus]] - code - frontend/src/pages/tasks/receiving/receiving-types.ts
- [[ReceivingLinesTable()]] - code - frontend/src/pages/tasks/receiving/ReceivingExecutionPanel.tsx
- [[ReceivingPrintInput]] - code - frontend/src/pages/tasks/receiving/receiving-print.ts
- [[ReceivingSummary]] - code - frontend/src/pages/tasks/receiving/receiving-types.ts
- [[SummaryCards()_2]] - code - frontend/src/pages/tasks/receiving/ReceivingExecutionPanel.tsx
- [[buildDiscrepancyNotes()]] - code - frontend/src/pages/tasks/receiving/receiving-utils.ts
- [[buildReceivingPrintHtml()]] - code - frontend/src/pages/tasks/receiving/receiving-print.ts
- [[buildReceivingPrintInput()]] - code - frontend/src/pages/tasks/receiving/receiving-print.ts
- [[computeLineStatus()_1]] - code - frontend/src/pages/tasks/receiving/receiving-utils.ts
- [[computeMissingQty()]] - code - frontend/src/pages/tasks/receiving/receiving-utils.ts
- [[computeReceivingSummary()]] - code - frontend/src/pages/tasks/receiving/receiving-utils.ts
- [[emptyAttributeDraft()]] - code - frontend/src/pages/tasks/receiving/ReceivingExecutionPanel.tsx
- [[emptyLineDraft()]] - code - frontend/src/pages/tasks/receiving/ReceivingExecutionPanel.tsx
- [[esc()_2]] - code - frontend/src/pages/tasks/receiving/receiving-print.ts
- [[exportReceivingLinesCsv()]] - code - frontend/src/pages/tasks/receiving/receiving-utils.ts
- [[filterReceivingLines()]] - code - frontend/src/pages/tasks/receiving/receiving-utils.ts
- [[formatDateOnly()]] - code - frontend/src/pages/tasks/receiving/receiving-utils.ts
- [[formatDim()]] - code - frontend/src/pages/tasks/receiving/receiving-utils.ts
- [[formatStagingLocation()]] - code - frontend/src/pages/tasks/receiving/receiving-print.ts
- [[handleComplete()_4]] - code - frontend/src/pages/tasks/receiving/ReceivingExecutionPanel.tsx
- [[handleWedgeScan()]] - code - frontend/src/pages/tasks/receiving/ReceivingExecutionPanel.tsx
- [[isLikelyFirstInbound()]] - code - frontend/src/pages/tasks/receiving/receiving-utils.ts
- [[lineDraftForOrderLine()]] - code - frontend/src/pages/tasks/receiving/ReceivingExecutionPanel.tsx
- [[lineDraftFromInboundOrderLine()]] - code - frontend/src/pages/tasks/receiving/receiving-utils.ts
- [[lineStatusClass()_1]] - code - frontend/src/pages/tasks/receiving/receiving-utils.ts
- [[lineStatusLabel()_1]] - code - frontend/src/pages/tasks/receiving/receiving-utils.ts
- [[localizedReceivingLineStatus()]] - code - frontend/src/lib/ui-labels/task-execution.ts
- [[localizedReceivingStatusFilterOptions()]] - code - frontend/src/lib/ui-labels/task-execution.ts
- [[lotExpiryForOrderLine()]] - code - frontend/src/pages/tasks/receiving/receiving-utils.ts
- [[matchLineByScan()]] - code - frontend/src/pages/tasks/receiving/ReceivingExecutionPanel.tsx
- [[matchScanToLine()]] - code - frontend/src/pages/tasks/receiving/receiving-utils.ts
- [[olLabel()]] - code - frontend/src/pages/tasks/receiving/ReceivingExecutionPanel.tsx
- [[openReceivingPrintPdf()]] - code - frontend/src/pages/tasks/receiving/receiving-print.ts
- [[parseDamagedFromDiscrepancyNotes()]] - code - frontend/src/pages/tasks/receiving/receiving-utils.ts
- [[parseExpiryFromDiscrepancyNotes()_1]] - code - frontend/src/pages/tasks/receiving/receiving-utils.ts
- [[parseHumanNotesFromDiscrepancyNotes()]] - code - frontend/src/pages/tasks/receiving/receiving-utils.ts
- [[parseQty()_2]] - code - frontend/src/pages/tasks/receiving/receiving-utils.ts
- [[parseQtyInput()]] - code - frontend/src/pages/tasks/receiving/receiving-utils.ts
- [[patchLine()]] - code - frontend/src/pages/tasks/receiving/ReceivingExecutionPanel.tsx
- [[productRequiresExpiry()]] - code - frontend/src/pages/tasks/receiving/receiving-utils.ts
- [[readExecutionDraft()]] - code - frontend/src/pages/tasks/receiving/ReceivingExecutionPanel.tsx
- [[receiveExpectedForLine()]] - code - frontend/src/pages/tasks/receiving/ReceivingExecutionPanel.tsx
- [[receiving-print.ts]] - code - frontend/src/pages/tasks/receiving/receiving-print.ts
- [[receiving-types.ts]] - code - frontend/src/pages/tasks/receiving/receiving-types.ts
- [[receiving-utils.ts]] - code - frontend/src/pages/tasks/receiving/receiving-utils.ts
- [[receiving-utils.unit.spec.ts]] - code - frontend/src/pages/tasks/receiving/receiving-utils.unit.spec.ts
- [[receivingDestinationLocationsSummary()]] - code - frontend/src/pages/tasks/receiving/receiving-print.ts
- [[receivingExpectedLotDisplay()]] - code - frontend/src/pages/tasks/receiving/receiving-utils.ts
- [[resolveLineExpiryDisplay()]] - code - frontend/src/pages/tasks/receiving/receiving-utils.ts
- [[validateReceivingLineQuantities()]] - code - frontend/src/pages/tasks/receiving/receiving-utils.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/ReceivingExecutionPaneltsx
SORT file.name ASC
```

## Connections to other communities
- 46 edges to [[_COMMUNITY_useToast]]
- 16 edges to [[_COMMUNITY_useWmsTranslation]]
- 15 edges to [[_COMMUNITY_OmsOrderCreatePage.tsx]]
- 9 edges to [[_COMMUNITY_Modal]]
- 7 edges to [[_COMMUNITY_TextField]]
- 6 edges to [[_COMMUNITY_ref_tanstack_react_query]]
- 3 edges to [[_COMMUNITY_reportstypes.ts]]
- 3 edges to [[_COMMUNITY_query-keys.ts]]
- 2 edges to [[_COMMUNITY_design-system-nextuiindex.ts]]
- 1 edge to [[_COMMUNITY_OmsOrdersListPage.tsx]]

## Top bridge nodes
- [[ReceivingExecutionPanel.tsx]] - degree 84, connects to 8 communities
- [[ReceivingExecutionPanel()]] - degree 49, connects to 4 communities
- [[receiving-utils.ts]] - degree 43, connects to 4 communities
- [[receiving-types.ts]] - degree 18, connects to 4 communities
- [[ReceivingLinesTable()]] - degree 15, connects to 3 communities