# Inbound order detail

**App:** Admin Dashboard  
**Route(s):** `/orders/inbound/:id`  
**Source:** `frontend/src/pages/InboundDetailPage.tsx` → `AdminInboundOrderSummary`  
**Spec:** `docs/architecture/unified-order-execution.md`

## Purpose

Single Order Execution View for every inbound origin: finish plan → print → physical work → Confirm (admin) or Release to workers.

## Primary users

Route `orders`: `super_admin`, `wh_manager`, `finance`.

## User goals

- Complete warehouse plan (dock + putaway) when incomplete  
- Print disposable instruction sheets  
- Confirm order (admin mode) or Release to workers  
- Monitor open tasks when already released  

## Business goal

Convert ASN into inventory via one Confirmation path; workers execute Tasks only when `executionMode=workers`.

## Main workflows

1. Open detail → Order Execution View (never stage workspace)  
2. Incomplete plan → Edit/Complete plan → return  
3. Print instructions → do physical work → Confirm order (`execute-admin`)  
4. Workers mode → Release to workers (`confirm` with plan-derived warehouse/staging) → monitor tasks  
5. After plan edit following a print → “Plan changed since last print” banner → reprint  

## Components

- `AdminInboundOrderSummary`  
- `OrderDocumentsCard`  
- `StatusBadge` / Planned badge  
- Print + Confirm/Release actions  
- Open-task links via workflow timeline  

## Actions

- Edit / Complete plan (`draft` \| `pending_approval`)  
- Print instructions  
- Confirm order XOR Release to workers (by `executionMode`)  
- No operational prompts at Confirm — plan must already be complete  

## Empty / loading

- Failed load Alert  
- Skeleton while loading  

## Notes

`OrderWorkspaceLayout` must not mount on this page. Client/OMS/API origins use the same UI.
