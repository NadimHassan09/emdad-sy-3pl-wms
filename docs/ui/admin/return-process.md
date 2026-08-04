# Return process

**App:** Admin Dashboard
**Route(s):** `/returns/:id/process`
**Source:** `frontend/src/pages/returns/ReturnProcessPage.tsx`
**Nav label:** Returns (process)

## Purpose

Line-by-line disposition workflow: receive → inspect → post inventory, then complete return.

## Primary users

Route `returns`: sa/mgr/operator. `isOperator = isOperatorRole` hides **Post all eligible** and **Complete return** footer actions for operators.

## User goals

- Receive returned qty per line
- Inspect and set disposition + target location
- Post inventory and complete return (managers)

## Business goal

Restock / quarantine / scrap returned goods correctly.

## Main workflows

1. Select active line needing work
2. Step `1 · Receive` → Quantity to receive, Condition (optional) → Receive
3. Step `2 · Inspect` → Condition, Disposition, Target location, Inspection notes → Save inspection
4. Step `3 · Post inventory` → Post line
5. Managers: Post all eligible / Complete return

## Components

- `PageHeader` title `Process return` with Details link → `/returns/:id`
- Line selector / active line summary
- `DispositionLocationPicker`
- Step panels for receive / inspect / post

## Forms

Per active line:

- Quantity to receive; Condition (optional) values: `new`, `good`, `damaged`, `unusable`
- Disposition options (labels): Restock; Quarantine; Damaged; Discard; Inspection required
- Target location (when disposition posts)
- Inspection notes

Footer (non-operators): Post all eligible; Complete return.

## Tables

- Process line list / selector (not a classic DataTable of all columns); line shows Expected / Received quantities.

## Filters

- None.

## Actions

- Receive / Save inspection / Post line
- Post all eligible / Complete return (hidden for operators)
- Navigate to Details

## Dialogs

- None (no ConfirmModal on this page).

## Drawers

- None.

## Empty states

- Handled via missing detail / no work lines as coded in page load paths.

## Loading states

- Detail query loading before process UI.

## Validation

- Receive qty; disposition/location required when posting postable dispositions (`canPostDisposition`).

## Permissions

- Route: sa/mgr/operator.
- Operators cannot Post all eligible or Complete return.

## Relationships with other pages

- Details → `/returns/:id`
- ← `/returns`

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
