# 02 — Component testing

**Scope.** One React component (or a small composition) rendered in isolation with mocked data/network: props → DOM → events → callbacks. No router backend, no real API (MSW or prop injection).
**Tools to use (phase 2).** Vitest + React Testing Library + `@testing-library/user-event` (+ `jest-axe` for a11y asserts, Playwright Component Testing for layout/visual-sensitive ones). 191 `.tsx` components exist across `frontend/src/components` and `client-frontend/src/components`; **no component test exists in the client frontend**, and the admin frontend only has `lib`-level specs plus a few Playwright UI specs.
**Each component is tested for:** (R) render states, (I) interaction, (K) keyboard, (A) a11y, (D) responsive/dir (`ltr`/`rtl`), (E) error/empty/loading, (S) snapshot of the *accessible tree* (not pixels).

Pass criteria are the **component contract** (props table) — the contract is written by the test author in the component's test file header and reviewed by the owner for anything visible to users (labels, colours, behaviours). Items marked **UX-owner** need an owner decision first (see `17`).

---

## 1. Shared primitives (admin `frontend/src/components`, client `client-frontend/src/components`+`design-v2`)

| ID | Component | Must be proven |
|---|---|---|
| CT-BTN-001 | `Button` (+ `IconButton`) | variants (primary green, secondary, danger red, ghost); **danger red used only for destructive** (owner rule); disabled (no click, `aria-disabled`, tooltip text when reason given), loading (spinner, no double click), icon-only has accessible name, min 44 px hit area on touch |
| CT-FLD-001 | `TextField` | label↔input association, required marker once, error text + `aria-invalid`, helper text, maxLength counter, numeric variant: **select-all on focus so a prefilled `0` can be overwritten**, `inputmode`, paste sanitising, RTL caret |
| CT-FLD-002 | `SelectField` | native select options, placeholder, disabled, error, keyboard |
| CT-CMB-001 | `Combobox` (searchable dropdown) | open on click/Enter/ArrowDown, type to filter (case-insens., Arabic folding), highlight, select by click/Enter, `Esc` closes and restores focus, **search text cleared after selection and shows the chosen label**, clear (×) button, async options (loading/empty/error), disabled, required, virtualised long lists (5,000 options), no flicker on fast typing, aria-combobox/listbox/option roles |
| CT-CMB-002 | `AnchoredDropdown` | anchors to trigger, flips above when no room below, repositions on scroll/resize, closes on outside click, z-index above modals, mobile: full-width sheet |
| CT-MOD-001 | `Modal` | focus trap, `Esc`, backdrop click policy, scroll lock, nested modals order, restores focus to opener, mobile full-screen, title `aria-labelledby`, long content scrolls inside |
| CT-CNF-001 | `ConfirmModal` | danger vs neutral style, typed-phrase mode, async confirm (pending/disabled), error stays open, default focus on *safe* action |
| CT-TOA-001 | `ToastProvider` | stack, auto-dismiss timing, manual close, `aria-live`, duplicate suppression, RTL placement |
| CT-TBL-001 | `DataTable` | columns config, sort indicator + callbacks, loading skeleton, empty state, row click vs action click (no bubbling), sticky header, horizontal scroll container on small width, column visibility on breakpoints, row selection (header tri-state), keyboard row focus/Enter, RTL, long text wrap vs `nowrap` for codes (order number never wraps) |
| CT-PAG-001 | `ServerPaginationBar`, `TableFooterPagination` | "a–b of N" math, disabled Previous/Next, size selector, jump, N=0, N<size, last partial page, i18n numerals |
| CT-FLT-001 | `FilterPanel`, `FilterActions`, `FilterCheckboxField`, `FilterScan*`, `AdminListPageShell`, `ListPageHeader` | Apply/Reset semantics (Reset **not red**), advanced toggle, filter chips count, persisted draft/applied state, scan fields fill value, wedge scanner (rapid key input + Enter) |
| CT-BDG-001 | `StatusBadge`, `Badge`, `statusMeta` | every status of every entity maps to label+colour, no raw enum, AR/EN, casing consistent ("Active" not "active") |
| CT-NAV-001 | `PillSubNav`, `PillTabs`, `StorePillTabs`, `SectionSubNavCard`, `section-nav-ownership` | active tab by route, wraps on narrow width without overlapping actions, keyboard arrows, billing sub-nav includes every billing page or hides none silently |
| CT-LAY-001 | `Layout`, `PortalLayout` | sidebar expanded/collapsed/mobile drawer, role-filtered items (`rbac.ts`), active item, quick-jump (Ctrl+K) lists only permitted pages and opens them, language/theme toggles persist, user menu, notification bell badge, **tablet 820 px behaviour** (sidebar currently stays expanded and squeezes content — decide collapse breakpoint), skip-link |
| CT-EXP-001 | `ListExportButtons`, `ClientOmsOrdersExportModal` | CSV/Excel trigger with current filters, disabled until data/Generate with hint, progress, error, file name |
| CT-IMG-001 | `ImageUploadField`, `ProductNameCell`, `CompanyNameCell` | upload types/size, preview, remove, broken-image fallback, long names truncation + title tooltip |
| CT-CPY-001 | `CopyEmailButton` (+ copy-shipment-info buttons) | clipboard API success/failure fallback, toast, a11y label |
| CT-MAP-001 | `DeliveryLocationMap` | pin set/move, lat/long fields in sync, tile load failure fallback, no grey seams (V-012), keyboard alternative |
| CT-ADR-001 | `CascadingAddressSelector` | governorate → city → town cascade, resets children on parent change, type-or-select free text, "Did you mean" suggestion, Arabic folding, disabled until parent chosen, preloaded edit values |
| CT-SCN-001 | `BarcodeScanModal`, `BarcodeImageModal`, `WedgeScanField`, `ConfirmReturnByScanModal`, `BarcodeScanIcon` | camera denied/allowed, manual entry, duplicate scan ignored, batch accumulation list with remove, invalid code message |
| CT-CHT-001 | `PieChart` + report charts | empty data, one slice, 100 slices (legend), long labels, colours colour-blind safe, dark mode, tooltip, RTL |
| CT-UPD-001 | `AppUpdateModal` + `useUpdateDetector` | shows when new build deployed, "Reload" works, does not loop |

## 2. Domain components (`frontend/src/components/<domain>`)

For each folder: open every component, enumerate props, write the cases below. Folder → required component cases (non-exhaustive names are placeholders; the executor lists the real files with `ls` and creates one case per file):

| ID | Folder | Mandatory cases |
|---|---|---|
| CT-ORD-001 | `orders/` + `OrderDraftLinesTable` | line editor: add/remove/duplicate, product search per client, qty rules, price/total recalculation, **same product twice**, min 1 line, read-only mode, currency formatting, long names |
| CT-OMS-001 | `oms/` | order header actions (Waybill, Cancel Shipment, Cancel order, Edit shipping fee, Open outbound) enabled/disabled per status table; pricing card (client rate Edit, carrier quote, actual cost); status chip text (no raw enum); title `OMS-…` without duplicate prefix; copy-shipment-info content; QR scan toolbar (6 modes) ; batch bar (counts in labels, destructive buttons separated) ; shipping modal (carrier cards, price in USD + carrier currency) ; group-by control |
| CT-INB-001 / CT-OUT-001 | `inbound/`, `outbound/` | plan editor, putaway plan rows, receiving form (received vs expected), shipping details form + "Mark complete" gating, execution mode radio cards |
| CT-TSK-001 | `tasks/` (incl. `tasks/receiving/receiving-utils` exists) | pick/pack/putaway/receive execution UI: scan flow, quantity stepper, discrepancy reason, offline retry (`useTaskProgressSave`), timer, assign worker select, **task detail page content (currently empty)** |
| CT-INV-001 | `products/`, `locations/`, `adjustments/` | product form (dimensions L/W/H optional with units, weight, lot tracking toggles, min stock), location tree (expand/collapse all, keyboard), location create (type constraints), adjustment form (before/after preview, reason required) |
| CT-FIN-001 | `finance/` | account table, adjust modal (credit/debit, reason, amount > 0), COD status controls (Confirm Collect/Remit), payout actions, policy cards (radio cards active state; B12 toggles; prep fee % input), float/recon textarea parser preview, transaction table label humanising |
| CT-BIL-001 | `billing/` | **invoice order tables** (inbound/outbound/OMS) with inline editable cells: click→input, blur saves, Esc cancels, invalid value reverts with message, optimistic total update, locked state when finalised (cells read-only, "Edit invoice" visible for admin), margin/carrier cost visible only in admin mode; storage calculator modal (preview table, missing-dimension warning, Add to invoice); incentive check card (qualifies / needs N more); plan form (prefilled 0 select-all, validation); charge-rule toggles |
| CT-RPT-001 | `reports/` | filter bar, view toggle List/Graph/Pivot, Generate gating Export buttons, tab strip wrap, empty state, no developer wording |
| CT-SHP-001 | `shipping/` | fee-rate group editor (destination picker tree: governorates → cities → neighbourhoods, "descendants included"), weight policy inputs, Test-a-price tool, carrier connection cards (masked secrets, Test connection/Disconnect/Register webhook states), FX panel (manual vs automatic, custom API URL validation, Test source result) |
| CT-BKP-001 | `backups/` | Create backup (cooldown), table (download token link), schedule form, retention cards, health cards (healthy vs critical event contradiction), header buttons not overlapping tabs on 820/390 px, Factory Reset/Restore confirms |
| CT-USR-001 | `users/` | user form per role, worker-profile toggle, custom-role matrix (12 chips toggle Denied/Allowed with keyboard + accessible state), deactivate confirm |
| CT-CLI-001 | `clients/` | company form (required, country, billing), detail card |
| CT-DOC-001 | `documents/`, `final-contracts/` | PDF open buttons EN/AR, create PDF progress/error, status badges |
| CT-AUD-001 | `audit-logs/` | row → JSON diff viewer (redaction, long JSON, copy), filter form |
| CT-DSH-001 | `dashboard/` | KPI cards (loading/zero/error), period pills, Needs-Attention list with Resolve, activity feed ordering, charts |
| CT-RET-001 | `returns/` | return plan lines (return qty ≤ delivered), stage buttons (approve/receive/put away), rollback buttons confirm |

## 3. Client portal components (`client-frontend/src/components`) — all **new** (0 existing)

| ID | Component | Must be proven |
|---|---|---|
| CT-C-001 | `PortalLayout`, `ClientSectionHeader`, `ClientPageIntro`, `ClientSurfaceCard`, `ClientMetricCard`, `ClientDetailShell` | nav per client role (client_admin vs client_staff), billing-restricted banner, role-access banner, mobile drawer |
| CT-C-002 | `BillingRestrictionBanner`, `client-billing-restriction.ts` | shows when account restricted; blocks creating orders; text AR/EN |
| CT-C-003 | `ClientOrderLinesTable`, `ClientWizardSteps` | order wizard steps, validation per step, back/next keep data |
| CT-C-004 | `ClientOrderTrackingPanel`, `ClientShipmentMovementPanel` | detailed carrier statuses (Arabic, e.g. "تم تكوين الشحنة") in chronological order, carrier name, tracking link, no carrier cost |
| CT-C-005 | `ClientOrderImportModal`, `ClientOmsOrdersExportModal`, `ClientOmsOrdersStatusNav` | template download (CSV/xlsx), file validation errors per row, export columns picker |
| CT-C-006 | `ClientRecentInvoicesCard`, `ClientStoragePanel`, `ClientMetricCard` | numbers formatted per currency rule; client sees USD only |
| CT-C-007 | `WebhooksSection` | add endpoint (https only), secret shown once, test delivery, event list, enable/disable, delete confirm |
| CT-C-008 | `components/sheets/*` | Sheets page: dropdown-only fixed fields with search, rows locked after admin approval (disabled + tooltip), Google connect button hidden/blocked state, hidden built-in API credentials not rendered in DOM |
| CT-C-009 | `design-v2/*` (`Card`, `Badge`, `IconButton`, `PillTabs`, `ListPageHeader`, `TableFooterPagination`, `useDebouncedValue`, `statusMeta`) | contract + tokens + dark mode |

## 4. Cross-cutting component rules (apply to every component test)

1. **Language:** render with `dir="rtl"` + Arabic strings; assert no overflow/clipping where text length +40 %.
2. **Theme:** render light & dark; assert tokens (no hard-coded colour outside tokens — `--text-link` duplicate-token class of bug).
3. **A11y:** `axe` has zero violations for each state; focus visible; names for icon-only controls (fee-rate ✎ ▶ ⏸, row ⋯).
4. **No raw technical text** in any rendered state: strings matching `/^[a-z]+(_[a-z]+)+$/`, `undefined`, `NaN`, `[object Object]`, `null`, UUID in place of a human code (Adjustment id, Lot id), internal tickets (`B12 —`, `O-11 —`).
5. **Controlled/uncontrolled** inputs do not warn in console; no `act()` warnings; no React key warnings.
6. **Performance smoke:** render 500 rows < 150 ms; re-render on keystroke in Combobox with 5,000 options < 50 ms.
7. **Error boundary:** a thrown child shows fallback, not blank page; error is reported.

## 5. Component → page traceability

Each component case lists the pages that use it (grep) so a component failure maps to affected pages in `14-coverage-matrix.md`. Mapping command for the executor: `grep -rl "<ComponentName" frontend/src/pages client-frontend/src/pages`.
