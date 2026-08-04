# Returns list (WMS)

**App:** Admin Dashboard
**Route(s):** `/returns`
**Source:** `frontend/src/pages/returns/ReturnsListPage.tsx`
**Nav label:** Returns → Dashboard

## Purpose

Warehouse return orders list with create modal and process handoff.

## Primary users

Route `returns`: `super_admin`, `wh_manager`, `wh_operator`.

## User goals

- Find returns by # / reference / status / dates
- Create a new return
- Open detail or process workflow

## Business goal

Process reverse logistics into inventory dispositions.

## Main workflows

1. Filter → open `/returns/:id`
2. Process button → `/returns/:id/process` when status `confirmed` \| `receiving` \| `inspecting`
3. `+ New return` → NewReturnModal

## Components

- `PageHeader` — title `Returns`; description `Receive, inspect, and restock customer returns.`
- `FilterPanel` title `Filters`
- `DataTable` (+ mobile card layout)
- `NewReturnModal`
- `StatusBadge`
- Tenant company alert when none selected

## Forms

**NewReturnModal** title `New return`:

- Client
- Linked outbound (shipped) / No outbound link
- Client reference
- Shipment reference
- Return reason / notes
- Lines: Outbound line / Product / Qty

## Tables

Columns: **Return #**, **Status**, **Products**, **Qty**, **Outbound**, **Disposition**, **Created**, **Processed**, Process action column.

Process button label: **Process**.

## Filters

FilterPanel title: **Filters**

| Field | Notes |
| --- | --- |
| Search | placeholder `Return #, reference…` |
| Status | All; Draft; Confirmed; Receiving; Inspecting; Completed; Cancelled |
| Created from / Created to | dates |

## Actions

- `+ New return`
- Open detail / Process
- Apply / Reset filters
- Retry on load error

## Dialogs

- **NewReturnModal** — `New return`

## Drawers

- None.

## Empty states

- Table: `No returns match the filters.`
- Mobile fallback: `No returns found.`
- Alert: `Select a tenant company to list returns.`
- Error: `Could not load returns`

## Loading states

- DataTable / list loading.

## Validation

- New return modal required client/lines as coded in component.

## Permissions

- Route: sa/mgr/operator.
- No extra canMutate gate on CTA beyond route + tenant company selection.

## Relationships with other pages

- → `/returns/:id`
- → `/returns/:id/process`
- Linked outbound references outbound orders

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
