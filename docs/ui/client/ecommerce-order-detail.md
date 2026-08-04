# Online order detail

**App:** Client Portal  
**Route(s):** `/ecommerce-orders/:id`  
**Source:** `client-frontend/src/pages/EcommerceOrderDetailPage.tsx`  
**Related:** `components/ClientOrderTrackingPanel.tsx`  
**Nav label:** Online orders (detail)

## Purpose

Full OMS order: recipient, pricing/COD, lines, status, timeline/tracking. Legacy English page chrome; tracking panel bilingual.

## Primary users

Admin + staff.

## User goals

- Verify order content and recipient
- Track fulfillment milestones
- See payment / COD amounts

## Business goal

Merchant-facing truth for ecommerce fulfillment and cash collection.

## Main workflows

1. Open → review header / pricing / lines / tracking → **← Back to online orders**

## Components

- Legacy card layout + status badge
- Rejection reason banner when rejected
- Pricing card
- Line items table
- `ClientOrderTrackingPanel`

## Forms

- None (read-only merchant view).

## Tables

**Line items**

| Column |
|--------|
| # |
| SKU |
| Product |
| Qty |
| Price |
| Line total |

Header fields: Order #, Recipient, Phone, Address, City, District, Required ship, Carrier, Tracking, Sales channel, Created, Warehouse status, Notes.  
Pricing: Payment, Shipping fee, Subtotal, COD status.  
Rejection: **Rejected: {rejectionReason}**.

## Filters

- None.

## Actions

| Control | EN |
|---------|-----|
| Back | ← Back to online orders |

Tracking: **Order tracking** / تتبع الطلب; **Timeline** / الجدول الزمني; milestones Pending approval → Delivered (+ AR); messages for cancelled / Rejected / Failed delivery / Returned / **No tracking events yet.**

## Dialogs

- None.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- Not found: **Online order not found.**
- Tracking empty: **No tracking events yet.** / لا توجد أحداث تتبع بعد.

## Loading states

- **Loading order…**

## Validation

- Load error: **Could not load this order. Please try again.**

## Permissions

Both roles. Read-only; no `useClientOperationalAccess` on detail.

## Relationships with other pages

- ← `/ecommerce-orders`, Dashboard, COD list row links
- Tracking shared with outbound OMS overlay

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
