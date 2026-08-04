# Contracts — GRN

**App:** Admin Dashboard
**Route(s):** `/contracts/grn` (`/contracts` redirects here)
**Source:** `frontend/src/pages/ContractsPage.tsx`
**Nav label:** Contracts → GRN

## Purpose

Goods Received Note document catalog and slot editing.

## Primary users

sa/mgr/operator/finance.

## User goals

- Find GRNs
- Edit document slots
- Open source inbound

## Business goal

Compliance documents for inbound.

## Main workflows

1. Filter → edit slot → open inbound

## Components

- FilterPanel
- DataTable

## Forms

- EditDocumentSlotModal.

## Tables

- GRN catalog.

## Filters

- Company/date/status filters.

## Actions

- Edit slot
- Open inbound

## Dialogs

- EditDocumentSlotModal.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- Not applicable or not explicitly implemented.

## Loading states

- Standard query pending / Suspense `PageLoadFallback` via layout.

## Validation

- N/A (no primary form).

## Permissions

Contracts group.

## Relationships with other pages

- → inbound orders

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
