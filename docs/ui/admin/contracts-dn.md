# Contracts — Delivery note

**App:** Admin Dashboard
**Route(s):** `/contracts/dn`
**Source:** `frontend/src/pages/ContractsPage.tsx`
**Nav label:** Contracts → Delivery note

## Purpose

Delivery note document catalog (same page component, DN mode).

## Primary users

sa/mgr/operator/finance.

## User goals

- Find DNs
- Edit slots
- Open outbound

## Business goal

Compliance documents for outbound.

## Main workflows

1. Filter → edit → open outbound

## Components

- FilterPanel
- DataTable

## Forms

- EditDocumentSlotModal.

## Tables

- DN catalog.

## Filters

- Document filters.

## Actions

- Edit slot
- Open outbound

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

- → outbound orders

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
