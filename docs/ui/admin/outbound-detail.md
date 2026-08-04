# Outbound order detail

**App:** Admin Dashboard  
**Route(s):** `/orders/outbound/:id`  
**Source:** `frontend/src/pages/OutboundDetailPage.tsx` → `AdminOutboundOrderSummary`  
**Spec:** `docs/architecture/unified-order-execution.md`

## Purpose

Single Order Execution View for every outbound origin (Admin, Client, OMS, API): finish plan → print → Confirm or Release.

## Primary users

Route `orders`: `super_admin`, `wh_manager`, `finance`.

## User goals

- Complete warehouse plan when incomplete  
- Print instructions  
- Confirm order (admin) or Release to workers  
- Monitor open tasks after Release  

## Business goal

Release inventory through one Confirmation path; workers use `/tasks/:id` only when mode is workers.

## Main workflows

1. Always mount Order Execution View (no stage tabs)  
2. Incomplete plan → Edit/Complete plan  
3. Admin mode → Confirm order (`execute-admin`)  
4. Workers mode → Release (`confirm` with warehouse from saved plan only)  
5. Print invalidation banner when `planUpdatedAt` changes after print  

## Components

- `AdminOutboundOrderSummary`  
- `OrderDocumentsCard`  
- Progress strip (Pick / Pack / Dispatch)  
- Open-task monitor links  

## Actions

- Edit / Complete plan (`draft` \| `pending_approval` \| `allocated`)  
- Print instructions  
- Confirm order XOR Release to workers  

## Empty / loading

- Failed load Alert + back link  
- Skeleton while loading  

## Notes

OMS approve hands off here via “Open warehouse outbound”. OMS cancel/delete does not cancel this outbound.
