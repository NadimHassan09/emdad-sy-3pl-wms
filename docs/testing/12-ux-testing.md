# 12 — User-experience (UX / usability) testing

**Principle (owner):** a feature is not "OK" because it works; it must work *the way a user expects* and not waste the user's time or effort. A control that exists but does nothing, does something else, or makes the user work harder is a UX defect even when no error appears.
**Method.** (1) Element-by-element verification of every interactive element on every page (§1). (2) Task-based walkthroughs per persona with measurable effort (§2). (3) Heuristic review with Nielsen's 10 + friction catalogue (§3). (4) Device matrix: desktop, laptop, tablet, mobile (touch), EN/AR.
**Input.** The numbered screenshots in `screenshots/` + the element lists in `04a/04b`. The executor first **inventories every interactive element** (DOM query for `button, a, input, select, textarea, [role=button|tab|combobox|menuitem|checkbox|switch]`, row-click targets, icons with handlers) and writes the inventory next to the screenshot; no element may remain without a verdict.

## 1. Element-level protocol (UX-EL) — applied to *every* element on *every* page

For each element record: **label · type · purpose (what a user expects) · action performed · result observed · matches expectation? · effort (clicks/keystrokes) · devices tested**.

| ID | Rule | Pass |
|---|---|---|
| UX-EL-01 | Every visible control does something on click/tap/Enter (no dead buttons, no empty handlers, no links to nowhere) | yes |
| UX-EL-02 | The something is what the label/icon implies (e.g. "Reset" resets, "Apply" applies; "Remember me" actually remembers; "Forgot password" actually sends a code; Google button signs in) | yes |
| UX-EL-03 | Disabled controls explain why (tooltip/inline text) and become enabled when the condition is met (Bulk Shipping, Export before Generate, Preview before client chosen, Create plan) | yes |
| UX-EL-04 | Feedback within 100 ms (pressed state), within 1 s progress for longer work, success/failure message that says what happened and what to do next | yes |
| UX-EL-05 | Destructive/irreversible actions are visually distinct, separated from safe ones, confirmed with consequence text; undo where cheap | yes |
| UX-EL-06 | Inputs accept natural user input: paste, autofill, Arabic digits, trailing spaces, different date/phone formats | yes |
| UX-EL-07 | Controls do not fight the user: no prefilled "0" that must be deleted, no search text left in the box after picking an item, no list reset after an action, no scroll jump, no focus loss, no modal closing on accidental backdrop click while typing | yes |
| UX-EL-08 | Default values and ordering sensible (most-used option first, today's date, last used client) and never *wrong* (default country SY, no auto-Acme) | yes |
| UX-EL-09 | Same control looks and behaves the same everywhere (labels, order of buttons, icon meaning) | yes |
| UX-EL-10 | Keyboard and touch parity (Enter/Esc/Tab; 44 px targets; no hover-only features) | yes |

## 2. Task walkthroughs (UX-TASK) — measured on the real system

Each task is performed by a fresh tester (or scripted agent) **without hints**; record time, clicks, errors, hesitation points, and satisfaction (1–5). Targets in the last column are guidelines to be confirmed by the owner (A-xx).

| ID | Persona | Task | Target |
|---|---|---|---|
| UX-TASK-001 | Admin | Create a COD order for a known client end to end (client → recipient → address → product → submit → approve) | ≤ 2 min, ≤ 25 clicks, 0 dead ends |
| UX-TASK-002 | Admin | Import 30 orders from the template (incl. 3 with mistakes) and fix the errors | ≤ 5 min; errors understandable without docs |
| UX-TASK-003 | Admin | Ship 20 approved orders with the cheapest eligible carrier (batch + bulk shipping + waybills) | ≤ 5 min |
| UX-TASK-004 | Warehouse operator (phone/tablet) | Pick, pack, scan, hand over an order; receive an inbound; put away | each ≤ 60 s per line, one-hand usable |
| UX-TASK-005 | Admin | Find "why is this order stuck?" (status, carrier, history) | ≤ 30 s |
| UX-TASK-006 | Accountant | Issue an on-demand invoice for a client for last month, correct one carrier cost, finalise, send PDF | ≤ 5 min |
| UX-TASK-007 | Accountant | Confirm COD remittance for 10 orders and verify client balance | ≤ 3 min |
| UX-TASK-008 | Manager | Check yesterday's numbers (dashboard + one report) and export | ≤ 2 min |
| UX-TASK-009 | Client admin (mobile) | Create an online order and see its tracking | ≤ 2 min |
| UX-TASK-010 | Client admin | Import orders, then fix a rejected row | ≤ 4 min |
| UX-TASK-011 | Client admin | Request inbound stock, then find the GRN | ≤ 2 min |
| UX-TASK-012 | Client admin | Understand balance, pending COD, request a payout | ≤ 2 min, numbers consistent across pages |
| UX-TASK-013 | Client admin | Create an API key and test the API from the docs | ≤ 5 min |
| UX-TASK-014 | Super admin | Create a custom role and assign it | ≤ 3 min |
| UX-TASK-015 | New admin (first day) | Reach every top-level area from the dashboard without help; identify where Templates / Charge rules live | all found ≤ 3 min |
| UX-TASK-016 | Any | Recover from errors: wrong data, double click, back button, session timeout mid-form | no data loss |
| UX-TASK-017 | Any | Switch language/theme mid-task | state kept |
| UX-TASK-018 | Any | Login, tick "Remember me", close browser, reopen; logout; reopen — verify the behaviour is what the tick promises (owner example) | exact |
| UX-TASK-019 | Any | "Forgot password" from login to new password | ≤ 2 min; email arrives; clear messages |
| UX-TASK-020 | Any | Sign in with Google (when UI enabled) incl. linking from profile; suspended account refused | works / refuses |

## 3. Friction catalogue — known and suspected UX defects (each must be reproduced and rated; fixing is phase 3)

| ID | Friction | Where | Source |
|---|---|---|---|
| UX-01 | After choosing an item in a searchable dropdown, the **search box keeps the selected text**; user must delete it to search again | Combobox everywhere (client select, product select, location, governorate…) | Owner example |
| UX-02 | Numeric fields prefilled with **"0"** require deleting before typing | billing plan create, line quantities, prices | Screenshot 058 |
| UX-03 | "Remember me" exists — verify it really persists/ends; and after logout it must not auto-login | login (both portals) | Owner example |
| UX-04 | "Forgot password" present — verify it works end to end | login | Owner example |
| UX-05 | Google sign-in/Sheets: feature visible but non-functional (403) — currently hidden; verify hidden everywhere (login, profile, backups, client sheets) | | Owner example; `GOOGLE_AUTH_UI_HIDDEN.md` |
| UX-06 | Floating action cards / menus after row selection misaligned or hanging in the air | list pages with selection (OMS, outbound, COD) | Owner example |
| UX-07 | Button rows misaligned by a few pixels (justify/align-items) | page headers, filter bars | Owner example |
| UX-08 | Filter **Reset** is red (looks destructive) and "Reset" vs "Reset filters" wording differs | most lists | V-003 |
| UX-09 | Disabled actions give no reason | Bulk Shipping, Export (RB), Preview/Calculate/Check (billing), Run reconciliation | V-010/V-018/V-026 |
| UX-10 | Raw technical text in UI (enums, UUIDs, internal ids, developer sentences) | OMS detail, adjustments, transactions, cycle-count, reports | V-007/V-015/V-018/V-022/V-024/V-034 |
| UX-11 | Dead-end page (task detail nearly empty; returns list says select tenant but offers no selector) | `/tasks/:id`, `/returns` | V-016/V-036 |
| UX-12 | Tablet shows desktop sidebar → tables unreadable | all lists on 820 px | V-044 |
| UX-13 | Two near-identical destructive buttons side by side ("Cancel Shipment" / "Cancel order"; "Cancel (1)" / "Cancel Shipments (1)") | OMS detail, batch page | V-034 |
| UX-14 | Information inconsistency: counts with "—", header count ≠ table count, status "Return Received" with empty quantities | COD/returns chips, locations, OMS return | V-013/V-037/V-034 |
| UX-15 | Page without a title or with an empty icon tile; internal ticket ids in titles | shipping companies, finance, policies | V-031/V-047/V-024 |
| UX-16 | Wording problems: "Field Delivery", "Auth group", "Cutover", "Legacy Billing", "Architectural Rule", doubled "OMS OMS-…" | | V-011/V-021/V-029/V-034 |
| UX-17 | Mixed date/number/currency formats | all | V-046/V-026 |
| UX-18 | Notification/Audit noise hides real signal | notifications (cycle notices), audit (refresh replay) | V-028/V-043 |
| UX-19 | Long lists without density control; row height 110 px on mobile | outbound | V-010 |
| UX-20 | Required marker doubled (`**`), inconsistent required hints | OMS new | V-012 |
| UX-21 | Navigation: billing sub-nav omits Templates/Charge rules; no breadcrumb on deep pages; back link inconsistent ("All adjustments" vs "Back to clients") | billing, details | V-025 |
| UX-22 | First-time/empty states without call to action | templates, custom roles, returns | |
| UX-23 | Error messages technical or unactionable (D-006 pattern) | carriers, imports | D-006 |
| UX-24 | Accidental data loss: navigating away from dirty forms, session expiry mid-form | create forms | FB-15 |
| UX-25 | Search placeholder/semantics unclear (adjustment search takes UUID) | adjustments | V-007 |

## 4. Heuristic review (UX-HE) — Nielsen 10 applied per area
Visibility of status · match with the real world (warehouse/3PL vocabulary in Arabic and English) · user control & freedom (undo, cancel, back) · consistency & standards · error prevention · recognition over recall · flexibility & efficiency (shortcuts, bulk, scan) · aesthetic & minimalist design · help users recover from errors · help & documentation. Each page gets a 1–5 score per heuristic with evidence screenshot.

## 5. Content & language UX (UX-CL)
EN/AR parity (every label, message, empty state, PDF), terminology glossary agreed with owner (Inbound/GRN, Outbound/DN, COD, Payout, Float, Cutover…), tone, number/date localisation, RTL punctuation, concise error text with next step.

## 6. Reporting rule
Every verdict includes *what the user expects*, *what happened*, *why this is acceptable or not*, and which assumption (A-xx) was used. Expectations the author cannot justify are escalated to the owner instead of guessed.
