# Return detail

**App:** Client Portal  
**Route(s):** `/returns/:id`  
**Source:** `client-frontend/src/pages/ReturnDetailPage.tsx`  
**Nav label:** Returns (detail)

## Purpose

Read-only return header and lines (expected/received/status) with link back to original order. English-only legacy layout.

## Primary users

Admin + staff.

## User goals

- Inspect return lines and status
- Jump to original order
- Return to returns list

## Business goal

Transparency on reverse logistics without merchant execution controls.

## Main workflows

1. Open detail → review fields / lines → back to list or original order link

## Components

- Legacy card layout
- Status badge
- Detail fields
- Line items table
- Link to original order

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
| Status |

Line status shown with `_` → spaces.  
Header fields: Original order (link), Created, Your reference, Notes. Title: **Return {orderNumber}**.

## Filters

- None.

## Actions

| Control | EN |
|---------|-----|
| Back | ← Back to returns |
| Original order | navigates to related order when present |

## Dialogs

- None.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- Not found: **Return not found.**

## Loading states

- **Loading return…**

## Validation

- Load error: **Could not load this return.**

## Permissions

Both roles. Read-only; no create / no `useClientOperationalAccess`.

## Relationships with other pages

- ← `/returns`
- → original ecommerce/outbound order when linked

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
