# Final contract

**App:** Admin Dashboard
**Route(s):** `/contracts/final-contract`
**Source:** `frontend/src/pages/FinalContractPage.tsx`
**Nav label:** Contracts → Final contract

## Purpose

Final contracts list with create/edit.

## Primary users

sa/mgr/operator/finance.

## User goals

- Manage final contracts

## Business goal

Commercial document closure.

## Main workflows

1. Filter → create/edit modal

## Components

- FilterPanel
- DataTable

## Forms

- CreateFinalContractModal.

## Tables

- Final contracts.

## Filters

- Company/status filters.

## Actions

- Create
- Edit

## Dialogs

- CreateFinalContractModal (create/edit).

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

- Documents module

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
