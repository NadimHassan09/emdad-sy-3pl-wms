# QA UI Audit — Staging Admin & Client Portals

**Role:** Senior QA Engineer  
**Method:** Live UI testing only (Playwright against staging). Code was not used as the source of truth.  
**Environments:**  
- Admin: https://staging-admin.emdadsy.com  
- Client: https://staging-client.emdadsy.com  

**Accounts exercised:**  
- Admin: `superadmin@emdad.example`  
- Client: `client@acme.example`  
- Manager login (`manager@emdad.example`) did **not** enter the app on staging (stayed on login) — role-permission matrix partially blocked  

**Evidence:** screenshots under `/var/www/emdad-sy-3pl-wms-staging/qa-ui-evidence/`  

**Scope:** Validation · Loading · Skeletons · Error messages · Permissions · Responsive · RTL · LTR · Keyboard · Accessibility · Broken buttons · Broken states · Visual glitches  

---

## Executive summary

Highest-confidence UI defects: **Client Filters button does nothing**; **row checkboxes/ellipsis are non-functional**; **product detail URLs bounce to the list**; **slow loads show a blank “Loading…” screen with no skeleton**; **RTL/Arabic leaves English nav and status strings mixed in**; **⌘K is shown on a Linux-served product**; **notification badges disagree in color** (sidebar green vs topbar red).

---

## 1. Validation

| ID | Severity | Portal | Observation |
|----|----------|--------|-------------|
| V1 | P1 | Admin | **Login fields use visually hidden labels** (`Email` / `Password` are `sr-only`); placeholders act as the visible labels. Screen/visible UX depends on placeholder text. |
| V2 | P2 | Admin | **New inbound** wizard: primary **Next** is **disabled** with empty required fields — no inline field errors, no helper text explaining why Next is blocked. User sees a dead-looking primary. |
| V3 | P2 | Client | Order/product **search inputs** are placeholder-only (no visible `<label>` association on Online / Inbound / Outbound / Products). |
| V4 | P1 | Client | Dashboard **date range inputs** have no accessible name (no `aria-label`, no `id`+`<label>`). |
| V5 | P3 | Admin | Bad password **does** show `Invalid email or password.` in an alert-style message — acceptable. |
| V6 | P3 | Client | Login shows visible Email/Password labels — better than Admin login. |

---

## 2. Loading

| ID | Severity | Portal | Observation |
|----|----------|--------|-------------|
| L1 | P0 | Admin | With delayed API responses, **Inbound** (and similar routed views) paint a **full-viewport “Loading…”** only — chrome (sidebar/filters/table shell) disappears. |
| L2 | P1 | Client | Dashboard under slow API also shows bare **“Loading…”** (no layout retention). |
| L3 | P1 | Admin | `/returns` briefly/sparsely presents loading-dominated content relative to expected list chrome. |

---

## 3. Skeletons

| ID | Severity | Portal | Observation |
|----|----------|--------|-------------|
| S1 | P0 | Both | During intentional slow loads: **`animate-pulse` / skeleton count = 0**. No skeleton table/cards; only static “Loading…” text. |
| S2 | P2 | Client | Happy-path pages that finish quickly hide the problem; skeleton gap appears under latency (common on mobile networks). |

---

## 4. Error messages

| ID | Severity | Portal | Observation |
|----|----------|--------|-------------|
| E1 | P3 | Admin | Failed login error is clear (`Invalid email or password.`). |
| E2 | P2 | Both | Browser **console** shows failed network resources (Admin `400`, Client `401`) during normal browsing — users don’t always see a matching in-page recovery UI for those calls. |
| E3 | P2 | Client | Empty/error empties are often one-line copy; no consistent retry control on every failure surface (varies by page). |

---

## 5. Permissions

| ID | Severity | Portal | Observation |
|----|----------|--------|-------------|
| P1 | P1 | Admin | **Could not complete multi-role UI matrix** on staging: `manager@emdad.example` + `demo123` remains on login. Super-admin can open Settings/Users — no denial UI observed for that role (expected). |
| P2 | P2 | Client | Staff vs admin money surfaces not fully re-tested with a staff account in this pass; admin client sees Billing + COD + Invoices together. |
| P3 | P2 | Client | Billing-restriction related copy appears in the logged-in shell (banner/text hits for suspended/restricted/billing) — verify visibility/clarity when account is actually restricted (content present in DOM for this tenant). |

---

## 6. Responsive design

| ID | Severity | Portal | Observation |
|----|----------|--------|-------------|
| R1 | P3 | Admin | Mobile (~390px): hamburger + logo + bell/avatar; content stacks. **No horizontal overflow** measured on Overview / Inbound. |
| R2 | P2 | Client | Mobile dashboard: KPI cards stack; **Order movement** donut dominates viewport; legend value sits far from label — hard to scan on small screens. |
| R3 | P2 | Admin | Mobile billing “Renew” buttons go full-width; one urgent row uses a stronger border than peers — inconsistent touch-affordance weight. |
| R4 | P2 | Both | Desktop search shows **⌘K** shortcut chrome on a Linux-hosted staging environment — misleading for non-Mac users (also see Keyboard). |

Screens: `admin-mobile-_dashboard_overview.png`, `client-mobile-_dashboard.png`, `Admin-mobile-_orders_inbound.png`.

---

## 7. RTL

| ID | Severity | Portal | Observation |
|----|----------|--------|-------------|
| RTL1 | P1 | Admin | Language is switched from **user menu → Language EN/AR** (not a dedicated top-level control). Easy to miss in QA/onboarding. |
| RTL2 | P0 | Admin | With AR active (`dir=rtl`): sidebar/content flip correctly, but **nav remains mixed language** — still shows English **Contracts**, **Billing**, and **OMS** among Arabic items. |
| RTL3 | P1 | Admin | Dates stay English (`Aug 5, 2026`) inside Arabic chrome. |
| RTL4 | P1 | Client | AR mode flips layout; **status filter options / some table status English leftovers** observed in outbound list sample (`Draft`, `Waiting for approval`, etc. still present in filter set while chrome is Arabic). |
| RTL5 | P2 | Client | Topbar profile + bell sit on the physical left in RTL while search sits toward the right — mirrored but crowded; dual identity (sidebar footer + topbar) remains. |
| RTL6 | P3 | Both | Forced AR mobile: **no horizontal overflow** measured in sampled views. |

Screens: `admin-forced-ar.png`, `client-forced-ar.png`.

---

## 8. LTR

| ID | Severity | Portal | Observation |
|----|----------|--------|-------------|
| LTR1 | P3 | Both | Default EN/`dir=ltr` shell is structurally stable on desktop. |
| LTR2 | P2 | Client | LTR dashboard: notification **count “3” appears twice** with **different badge colors** (see Visual glitches). |
| LTR3 | P2 | Admin | LTR Overview empty states (“No overdue clients”, “No suspended accounts”) are plain text inside cards — acceptable but easy to miss vs skeleton/error patterns. |

---

## 9. Keyboard navigation

| ID | Severity | Portal | Observation |
|----|----------|--------|-------------|
| K1 | P3 | Admin | First **Tab** focuses **Skip to main content**; **Enter** moves to `#main-content` — works. |
| K2 | P1 | Client | **No skip-to-content** control found. |
| K3 | P2 | Client | Many focus stops (e.g. sidebar Dashboard) use `outline: none`; some rely on box-shadow rings — **inconsistent focus visibility**. |
| K4 | P1 | Both | **⌘K** affordance displayed; on non-Mac keyboards this suggests a shortcut that may not match OS (Ctrl/Cmd mismatch risk). |
| K5 | P2 | Admin | Inbound modal: disabled **Next** is not keyboard-explainable (no live region / error summary when focusing the disabled control). |

---

## 10. Accessibility

| ID | Severity | Portal | Observation |
|----|----------|--------|-------------|
| A1 | P1 | Admin | Login: visible labels are screen-reader-only; sighted users get placeholders only. |
| A2 | P0 | Client | **Inbound/Outbound**: multiple **icon buttons with empty accessible names** (row action `…` controls). |
| A3 | P1 | Client | Search/date fields without programmatic labels (dashboard dates; list searches). |
| A4 | P1 | Client | Profile: large dashed upload/control button without accessible name. |
| A5 | P2 | Client | Decorative/unnamed controls inflate keyboard stop count without announcing purpose. |
| A6 | P3 | Admin | Skip link exists (good). Client lacks equivalent. |

---

## 11. Broken buttons

| ID | Severity | Portal | Observation |
|----|----------|--------|-------------|
| B1 | P0 | Client | **Outbound (and same pattern Inbound): `Filters` button** — click produces **no dialog, no popover, no DOM/text change**. Dead control beside a working status `<select>`. |
| B2 | P0 | Client | **Row `…` / action buttons** — click opens **no `role="menu"`**; no visible action sheet. |
| B3 | P1 | Admin | Inbound create: **Next** disabled with no explanation — behaves like a broken primary until fields are filled (validation UX failure perceived as broken CTA). |

Evidence: Filters click `{ dialog: 0, changed: 0 }`; ellipsis `menu: 0`.

---

## 12. Broken states

| ID | Severity | Portal | Observation |
|----|----------|--------|-------------|
| BS1 | P0 | Client | **`/products/:id` redirects to `/products`** — detail state cannot be opened via URL; inventory drill-down from dashboard dies. |
| BS2 | P0 | Client | Table **checkboxes** can be checked; **no bulk action bar / selected count** appears — selection state is meaningless. |
| BS3 | P1 | Both | Loading state replaces entire page with “Loading…” — loss of context (filters/nav memory) is a broken progressive state. |
| BS4 | P1 | Admin | RTL language mode = **partial translation state** (mixed EN/AR nav) — product appears half-localized. |
| BS5 | P2 | Client | Global search chrome promises entity search; behavior is page jump (prior merchant audit); UI state still presents search-as-find. |
| BS6 | P1 | Staging | **Manager demo login fails** — cannot verify operator/manager permission empty states or hidden nav in UI. |

---

## 13. Visual glitches

| ID | Severity | Portal | Observation |
|----|----------|--------|-------------|
| G1 | P1 | Client | **Unread count “3”**: sidebar badge **emerald/green**, topbar bell badge **red** — same number, conflicting severity color. |
| G2 | P2 | Client | Mobile Order movement: large donut + legend value detached from label. |
| G3 | P2 | Admin | Billing renew row styling inconsistent (urgent teal border vs flat gray peers). |
| G4 | P2 | Both | **⌘K** chip is Mac-centric visual chrome on Linux staging. |
| G5 | P2 | Client RTL | Dual profile presentation (sidebar + topbar) + mirrored chrome feels crowded; not a layout crash, but noisy. |
| G6 | P3 | Admin RTL | Grid card order flips with RTL; content remains readable; mixed-language labels are the main visual inconsistency. |

---

## Defect priority board

### P0 — ship blockers for UI trust
1. Client **Filters** button dead  
2. Client row **actions (…)** dead  
3. Client **product detail route redirects to list**  
4. Client **checkboxes without bulk actions**  
5. **No skeletons** — blank “Loading…” full page under latency  
6. Admin **RTL mixed English nav** (Contracts / Billing / OMS)

### P1 — high
- Unnamed icon buttons (Client lists)  
- Dashboard date inputs unlabeled  
- Client missing skip link  
- Disabled Next without validation message (Admin inbound)  
- Notification badge color mismatch  
- Admin login placeholder-only visible labels  
- Manager account cannot be used to test permissions on staging  

### P2 — medium
- Inconsistent focus rings  
- ⌘K Mac affordance  
- Console 400/401 without always-visible recovery  
- Mobile donut/legend spacing  
- Placeholder-only search fields  

### P3 — low / pass notes
- Admin skip-link works  
- Admin failed-login error text works  
- Client login visible labels OK  
- No measured horizontal overflow on sampled mobile RTL/LTR views  

---

## Test coverage gaps (explicit)

- Full **permission matrix** (operator / finance / client_staff) — blocked by manager login failure on staging  
- Destructive confirm modals (delete/purge) not exercised end-to-end  
- Pack/receive execution panels not opened in this UI pass (task assign gates)  
- Print / camera barcode modals not visually verified  
- Reduced-motion / high-contrast not tested  

---

## Pass signals observed

- Admin skip-to-content keyboard path works  
- Admin invalid credentials show an explicit error  
- Client login has visible labels  
- Basic mobile stacking without horizontal scroll on sampled pages  
- AR `dir=rtl` does flip shell layout when language is set to AR  

---

*End of QA UI audit. Findings from live UI observation only.*
