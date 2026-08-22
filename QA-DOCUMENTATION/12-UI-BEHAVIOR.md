# 12 — UI Behavior (Shared Patterns)

**Confidence:** High for shared shell patterns. Medium for pixel-perfect empty-state copy on every page.

---

## Design / chrome patterns

Both portals share:

- Collapsible/responsive sidebar
- Topbar quick jump, theme toggle, notifications, user menu
- EN/AR language toggle
- Light/dark theme toggle
- Role-filtered navigation
- Card/table layouts for lists
- Detail pages with status badges and action buttons

---

## Loading states

| Context | Typical UX |
|---------|------------|
| App boot / auth | **Loading…** or full-page spinner |
| Table fetch | Skeleton rows or spinner over table |
| Button submit | Button disabled + busy label (Signing in…, Submitting…) |
| PDF generate | Button busy until file ready |

QA should not treat brief loading as failure.

---

## Empty states

When filters match nothing or module has no records:

- Empty illustration or message
- Often still shows Create / Import CTA when permitted

Do not report empty state as a bug if filters exclude all data.

---

## Success feedback

- Toast / banner after create, approve, cancel
- Redirect to detail or list with new row visible
- Status badge change

---

## Error feedback

- Inline field validation (red text / invalid borders)
- Form-level alert summarizing API error
- Toast for failed actions
- Role banner for unauthorized pages (client)

See `13-ERRORS-AND-VALIDATION.md`.

---

## Disabled / hidden actions

| Pattern | Meaning |
|---------|---------|
| Hidden button | User/role/status cannot perform action |
| Disabled button | Visible but blocked (e.g., billing restricted, missing required field) |
| Confirmation dialog | Destructive or irreversible actions (cancel, revoke, delete) |

Prefer checking **visibility** before assuming a missing feature is a bug — many actions are status-gated.

---

## Tables

Common capabilities (not every table has all):

- Column headers with status badges
- Search box
- Status filter chips / dropdowns
- Pagination
- Row click → detail
- Row action menus
- Bulk actions (e.g., labels) on some order screens
- Export CSV on inbound/outbound/OMS admin lists

Sorting: present on some tables — **NEEDS VERIFICATION** per page.

---

## Forms

Shared behaviors:

- Required fields marked
- Cancel discards and navigates back
- Submit validates client-side then server-side
- Cascading selects (address) clear dependent fields
- Date inputs with min=today on ship/arrival dates for client creates

---

## Modals

Used for import, confirmations, barcode/details, package labels, API secrets, etc.

- Escape / Cancel closes without saving
- Primary button confirms
- Import modals include **Download template** and error file download on failure

---

## Pagination

Changing page should keep filters. Rapid page switching should not corrupt rows permanently; if flicker occurs during load, wait for settle.

---

## Accessibility / language

- Switching to Arabic should flip major chrome labels
- Incomplete translations may leave some English strings — log as localization gap with Confidence Medium, not always a functional bug

---

## Print

Some screens use `window.print` (client invoices). Browser print dialog appears; canceling print is not a product failure.
