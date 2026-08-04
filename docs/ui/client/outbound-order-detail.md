# Outbound order detail

**App:** Client Portal  
**Route(s):** `/outbound-orders/:id`  
**Source:** `client-frontend/src/pages/OutboundOrderDetailPage.tsx`  
**Related:** `components/ClientOrderTrackingPanel.tsx` (when OMS data exists)  
**Nav label:** Outbound (detail)

## Purpose

Show one WMS outbound header, lines, optional OMS customer/financial overlay, and bilingual tracking panel when linked.

## Primary users

Admin + staff.

## User goals

- Verify shipment destination/carrier/tracking
- See pick progress on lines
- Follow OMS-style milestones when applicable

## Business goal

Merchant visibility into warehouse outbound execution (and OMS overlay when present).

## Main workflows

1. Open detail → review sections → back to list
2. If OMS-linked: review Customer / Financial + `ClientOrderTrackingPanel`

## Components

- Legacy English card layout
- Pending-approval banner
- Optional Customer / Financial sections
- Line items table
- `ClientOrderTrackingPanel` (bilingual milestones)

## Forms

- None (read-only).

## Tables

**Line items**

| Column |
|--------|
| # |
| SKU |
| Product |
| Requested |
| Picked |
| Line status |

Header fields: Order #, Client, Required ship, Destination, Carrier, Tracking, Created, Your reference, Confirmed, Shipped, Notes.  
Customer (if OMS): Name, Phone, City.  
Financial (if OMS): Payment, COD amount, COD status, Subtotal.

## Filters

- None.

## Actions

| Control | EN |
|---------|-----|
| Back | ← Back to outbound orders |

Tracking panel section headers: **Order tracking** / تتبع الطلب, **Timeline** / الجدول الزمني. Milestone labels: Pending approval, Approved, Picking, Packing, Ready to ship, Out for delivery, Delivered (+ AR). Special messages: cancelled / Rejected / Failed delivery / Returned / **No tracking events yet.**

## Dialogs

- None.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- Not found: **Outbound order not found.**
- Tracking: **No tracking events yet.** / لا توجد أحداث تتبع بعد.

## Loading states

- **Loading order…**

## Validation

- Load error: **Could not load this order. Please try again.**
- Pending: **This order is waiting for warehouse approval. Processing will begin after approval.**

## Permissions

Both roles. Read-only; no create gate on detail.

## Relationships with other pages

- ← `/outbound-orders`
- May share tracking UI with `/ecommerce-orders/:id`

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
