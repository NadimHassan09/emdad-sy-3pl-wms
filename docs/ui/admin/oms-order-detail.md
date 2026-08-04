# OMS order detail

**App:** Admin Dashboard  
**Route(s):** `/orders/oms/:id`, `/oms/orders/:id`  
**Source:** `frontend/src/pages/OmsOrderDetailPage.tsx`  
**Spec:** `docs/architecture/unified-order-execution.md` (§ OMS handoff)

## Purpose

OMS commercial lifecycle only. Warehouse work happens on the linked outbound Order Execution View — not on this page.

## Primary users

OMS/orders roles: `super_admin`, `wh_manager`, `finance`.

## User goals

- Approve / reject commercial order  
- Open warehouse outbound after approve  
- Edit commercial fields; advance delivery status  
- Understand OMS cancel/delete ≠ outbound cancel  

## Business goal

Release merchant demand into a WMS outbound draft (`executionMode=admin`, incomplete plan), then hand Admin to outbound planning + Confirm.

## Main workflows

1. Approve OMS → creates draft outbound → navigate / CTA **Open warehouse outbound**  
2. Plan + Confirm on `/orders/outbound/:id` (Order Execution View)  
3. Reject with optional reason  
4. Delivery status actions (out for delivery, delivered, etc.)  
5. Delete OMS record with warning that linked outbound is untouched  

## Components

- Sections: Overview, Customer, Shipment, Payment, Products, Timeline, Warehouse (WMS)  
- Primary handoff: **Open warehouse outbound**  
- Modals: approve / reject / delete / edit  

## Forms

- Approve: optional shipping fee → creates outbound draft  
- Reject: optional reason  

## Actions

Status-gated commercial actions plus warehouse handoff CTA. No Confirm / execute-admin on OMS page.

## Dialogs

- Delete warning: OMS delete does not cancel linked warehouse outbound  
- Approve / Reject modals  
- `OmsOrderFormModal`  

## Empty states

- Timeline: `No timeline events yet.`  
- WMS: approve to generate draft, then plan/Confirm on outbound  
