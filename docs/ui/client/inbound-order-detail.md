# Inbound order detail

**App:** Client Portal  
**Route(s):** `/inbound-orders/:id`  
**Source:** `client-frontend/src/pages/InboundOrderDetailPage.tsx`  
**Nav label:** Inbound (detail)

## Purpose

Show one inbound header and lines (expected/received/lot), including pending-approval messaging. Legacy English-only card layout.

## Primary users

Admin + staff.

## User goals

- See receiving progress
- Inspect lines
- Return to list

## Business goal

Transparency on ASN fulfillment without giving merchants floor execution controls.

## Main workflows

1. Open detail → review header + line items → **← Back to inbound orders**

## Components

- Classic `.main` / `.card` header
- Status badge (`humanizeStatus`: snake_case → spaces, EN)
- Pending-approval banner when applicable
- Line items data-table

## Forms

- None (read-only).

## Tables

**Line items**

| Column |
|--------|
| # |
| SKU |
| Product |
| Expected |
| Received |
| Lot |

Header fields: Order #, Client, Expected arrival, Created, Your reference, Confirmed, Completed, Notes.

## Filters

- None.

## Actions

| Control | EN |
|---------|-----|
| Back | ← Back to inbound orders |

## Dialogs

- None.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- Not found: **Inbound order not found.**
- Missing field values as blank/`—` where coded.

## Loading states

- **Loading order…**

## Validation

- Load error: **Could not load this order. Please try again.**
- Pending banner: **This order is waiting for warehouse approval. Processing will begin after approval.**

## Permissions

Both roles. Read-only; no `useClientOperationalAccess` create gate on detail.

## Relationships with other pages

- ← `/inbound-orders`
- Title: **Inbound order {orderNumber}**

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
