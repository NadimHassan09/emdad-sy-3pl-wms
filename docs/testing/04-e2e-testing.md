# 04 — End-to-end (browser) testing

E2E = a real user in a real browser against staging. Three layers in this file:

1. **§A Standard batteries** — checks applied to *every* page of a given kind (list / form / detail / report / settings / dashboard / auth). Pages in `04a` and `04b` name the battery they use.
2. **§B Business flows** — multi-page workflows (order to cash, returns, carriers, workers, finance, billing, client portal, external API).
3. **§C Modal / dialog / state inventory** — the pop-ups and states that have to be screenshotted per page.

Device rule: every case runs on desktop, laptop, tablet, mobile (see `00` §4) unless marked `D` (desktop only because it is a data flow whose UI is identical). Flows are executed on **desktop first** and the layout-sensitive steps repeated on mobile.

---

## §A Standard batteries

Oracle for all battery items is **C/D** unless stated. `Pri` default P1; items marked ★ are P0.

### LB — list page battery (24)

| ID | Check | Expected |
|---|---|---|
| LB-01★ | Open page from sidebar and by direct URL | Renders < 3 s, no console error, no 4xx/5xx in network tab, skeleton replaced by data |
| LB-02 | Empty result (search "zzzzzzzz") | Empty-state message + way to reset; table header kept |
| LB-03★ | Pagination: Next/Previous enabled/disabled at ends; page-size selector (10/20/50/100); label "a–b of N" | N equals API total; last page partial rows correct; changing size returns to page 1 |
| LB-04 | Sort each sortable header asc → desc → none | Order correct for text (Arabic + English), number, date; stable; indicator arrow |
| LB-05 | Search box: lowercase/uppercase, Arabic, leading/trailing spaces, `%` `_` `'` `"` `<script>` `\`, 300 chars, paste, clear (×) | No error, injection inert, matches case-insensitive, trim applied |
| LB-06 | Searchable dropdown filters: type → pick → reopen | **Search text is cleared after selection** (UX defect reported by owner); selected value shown; clear control works |
| LB-07★ | Each filter individually and combined; Apply vs auto-apply; Reset; Advanced Filtering toggle; filter persistence (`wms.listUi.*` in localStorage) after reload/back | Combined filters = AND; Reset restores defaults *and* clears persisted state; persistence is intentional and visible (chip) |
| LB-08 | Status/summary cards | Click = filter; counts equal API totals; sum of statuses = All; counts not "—" |
| LB-09★ | Row click and row action menu (⋯) | Click opens detail; menu items depend on status; impossible actions hidden/disabled with reason |
| LB-10 | Bulk selection: header checkbox, eligible-only, count badge, selection kept/cleared on page change, bulk action confirm + result summary | Only eligible rows selectable; partial failure listed per row |
| LB-11★ | Export CSV and Excel | File name pattern, headers translated, row count = filtered total (not page), UTF-8 (Arabic OK), Excel branded + analytics block (owner #19), no formula injection (`=`,`+`,`-`,`@` prefixed cells neutralised) |
| LB-12 | Import (if page has Import): template download, valid file, invalid file, empty file, wrong columns, 1,000 rows, duplicates | Row-level errors list; nothing half-imported without notice |
| LB-13 | Copy buttons / copy-to-clipboard | Exact value copied, toast shown, works on mobile Safari |
| LB-14 | Colour semantics (owner rule): red = delete/cancel only, green = primary/approve, grey/white = neutral | **Reset/Apply filter buttons: Reset is not red** (currently red on most pages) |
| LB-15 | Consistency: label text ("Reset filters" vs "Reset"), badge casing, date format, number/currency format, units | Same control → same wording/format across pages |
| LB-16★ | Responsive 4 devices: header actions wrap without overlap, table scroll/cards, no horizontal page scroll, sticky header, tap targets ≥ 44 px | No clipped actions (ex: "Locatio/Deactiv" clipped on mobile) |
| LB-17 | RTL/Arabic: layout mirrored, icons mirrored where directional, mixed Arabic+Latin+digits, truncation side | Correct |
| LB-18★ | Roles: each of 10 roles opens page directly + via nav | Per `rbac.ts`; forbidden → redirect/403 page, not blank |
| LB-19★ | Tenant: client A data never visible to client B / outside company scope | Verified with 2 clients |
| LB-20 | Keyboard: Tab order, Enter on focused row, Esc closes menus/modals, focus ring visible | Works |
| LB-21 | Reload / back / forward / deep link with filters | State restored or explicitly reset |
| LB-22 | Realtime: change data from second session (API) | List/counters update without reload where the module advertises realtime |
| LB-23 | Error states: API 500 (route intercepted), offline, slow 10 s | Friendly message + retry; no raw JSON/stack; no infinite skeleton |
| LB-24 | Session expiry mid-use (delete cookie / expire token) | Redirect to login, returns to same page after login, no data loss on unsaved filters |

### FB — form page / modal battery (25)

| ID | Check | Expected |
|---|---|---|
| FB-01★ | Open (new + edit) | Defaults sensible; required fields marked once (no `**`); first field focused |
| FB-02★ | Submit empty | Inline error per required field, summary optional, focus first error, nothing sent |
| FB-03 | Whitespace-only in each text field | Treated as empty |
| FB-04 | Length boundaries: min, max, max+1, 10,000 chars | Counter/limit message; server limit equals client limit |
| FB-05 | Numbers: 0, −1, 0.001, 1e9, "1,5", "١٢٣" (Arabic digits), leading zeros, pasted text | Rejected or normalised per rule; **default "0" does not force the user to delete it first** |
| FB-06 | Dates: past, today, far future (2999), invalid, DST/timezone, from > to | Business rule enforced (e.g. expected arrival not absurd) |
| FB-07 | Phone: `+963…`, `09…`, `00963…`, spaces, dashes, Arabic digits, 5 digits, 25 digits | Normalised to one format; invalid rejected |
| FB-08 | Email: valid/invalid/uppercase/unicode/plus-tag/trailing space | Same |
| FB-09★ | Dropdowns/comboboxes: searchable, keyboard, clear, required, disabled-until-parent-chosen; dependent chains (governorate → city → town) reset children on parent change | Correct; no stale child value |
| FB-10 | Arabic/English/emoji/HTML/SQL strings in every text field, then view in list/detail/PDF/export | Stored verbatim, escaped on render, PDFs render Arabic shaping |
| FB-11 | Paste and browser autofill (names, phones, addresses) | No format break; autocomplete attributes sane |
| FB-12★ | Double submit (double-click, Enter + click, slow network) | Exactly one record; button disabled while pending |
| FB-13★ | Success path | Toast, redirect/refresh, record in list, audit log row, correct totals |
| FB-14 | Server-side validation error | Mapped to the right field; message human-readable; form values kept |
| FB-15 | Dirty form + navigate away / Cancel / browser back | "Discard changes?" confirm |
| FB-16 | Unsaved draft persistence (if feature) | Restored or explicitly not supported |
| FB-17 | File upload (photo, import file, sheet): wrong type, 0 byte, > limit, double extension, huge image, SVG with script, filename with Arabic/quotes | Rejected with message; safe storage |
| FB-18 | Line-items editor: add/remove/duplicate lines, min 1 line, qty bounds, same product twice, product search per client, totals recalculated, remove last line | Rules consistent |
| FB-19 | Permissions: read-only roles see form disabled / no submit | Server also rejects (IT) |
| FB-20 | Mobile: correct keyboard (`inputmode`), no zoom-on-focus (font ≥ 16 px), sticky submit bar not covering fields | OK |
| FB-21 | Accessibility: label↔input, `aria-invalid`, error association, required announced | OK |
| FB-22 | Reload after success / back button after submit | No duplicate submit |
| FB-23 | Concurrent edit in two tabs | Last write wins with warning or optimistic-lock error |
| FB-24 | Edit prefill & PATCH only changed fields | No unintended overwrite (e.g. clears optional field) |
| FB-25 | Destructive confirms (delete, cancel, deactivate, factory reset) | Red confirm, consequence text, typed phrase for irreversible |

### DB — detail page battery (12)

| ID | Check | Expected |
|---|---|---|
| DB-01★ | Open by valid id; unknown UUID; malformed id; id of another tenant | Content / 404 page / 400 / 403-404 without leaking names (cf. V-038) |
| DB-02 | Header/status chip text and colour | Human label (no raw enum like `waiting_for_shipping_details`), same chip as list |
| DB-03★ | Action buttons per status (matrix in `05`) | Enabled/disabled/hidden correctly; reasons shown |
| DB-04★ | Each action: confirm dialog → success → page and list refresh; failure message | State changes once; related entities updated |
| DB-05 | Sections, collapsible cards, copy buttons | Work |
| DB-06 | Links to related entities (OMS ↔ outbound ↔ inbound traceability ↔ returns ↔ invoice) | Correct id; back returns to list state |
| DB-07 | PDF / print / waybill buttons | Open/download; content equals data |
| DB-08 | Timeline/history ordering and timezone | Newest/oldest consistent; local time |
| DB-09 | Responsive header: ≥ 5 buttons wrap into clear rows | No truncated title ("OMS OMS…") |
| DB-10 | Realtime refresh when status changes elsewhere | Updates |
| DB-11 | Audit trail entry for each action | Present, actor right |
| DB-12 | Print stylesheet | Clean |

### RB — report battery (14)

| ID | Check | Expected |
|---|---|---|
| RB-01★ | Default Generate | Rows/totals equal the same SQL on staging DB |
| RB-02 | Each filter (date range, client, status…) | Matches SQL; invalid range (from > to) rejected |
| RB-03 | List / Graph / Pivot toggles; Bar/Line/Pie | Same numbers across views; legends/axes labelled; empty chart state |
| RB-04 | Sort and server pagination | Whole-result sort, not page-only |
| RB-05★ | Export CSV / Excel after Generate (and button disabled before, with hint) | Equal to screen; branded; analytics block |
| RB-06 | Large range (1 year, all clients) | < 5 s or progress indicator, no timeout |
| RB-07 | Tabs between 19 reports keep filters where sensible; tab strip wraps well on mobile | OK |
| RB-08 | Currency/unit labels | Per policy (USD for client money; carriers SYP) |
| RB-09 | Empty report | Message |
| RB-10 | Roles: client roles cannot reach; finance sees finance reports | Per matrix |
| RB-11 | Developer wording ("Server-side reporting … no bulk client fetch") | Not shown to end users |
| RB-12 | Rounding/total of percentages | Documented |
| RB-13 | Time zone boundaries (00:00 / 23:59 in Asia/Damascus) | Inclusive range semantics documented |
| RB-14 | Cache/staleness | Generate always fresh |

### SB — settings page battery (10)

| ID | Check | Expected |
|---|---|---|
| SB-01★ | Change each control, reload | Persisted |
| SB-02 | Auto-save on blur vs explicit Save — feedback | Visible "saved" / error |
| SB-03 | Validation of each value (range, type) | Server + client |
| SB-04★ | Dangerous toggle/button (deactivate cutover, factory reset, cleanup, disconnect carrier) | Confirm with consequence text |
| SB-05 | Audit log row with before/after | Present, secrets masked |
| SB-06★ | Downstream effect (system test link) | Setting really changes behaviour (e.g. COD policy changes when balance becomes available) |
| SB-07 | Permission | Only allowed role can change; others read-only/hidden |
| SB-08 | Secrets masked after save, never in DOM/network responses | OK |
| SB-09 | Two admins change simultaneously | No silent overwrite |
| SB-10 | Internal ticket IDs in titles ("B12 —", "O-11 —") | Not shown to users |

### DASH — dashboard battery (8) and AUTH — authentication pages (20)

DASH-01 every KPI equals source · DASH-02 period/filter switch · DASH-03 deep links from cards · DASH-04 realtime refresh · DASH-05 per-role widgets · DASH-06 export · DASH-07 loading/error · DASH-08 responsive card reflow.

AUTH-01 login valid · 02 wrong password · 03 unknown email (same message, no enumeration) · 04 inactive/suspended account (message + `/account-inactive` on client) · 05 lockout/throttle after N failures (Throttler) · 06 "Remember me" persists session for 30 days and unticked ends with browser · **07 logout really clears remember-me and cookies; Back button after logout shows login** · 08 expired session redirect · 09 refresh-token rotation (parallel requests, `AUTH REFRESH REPLAY` handling) · 10 forgot password: request code → email arrives (SMTP) → enter code → new password → old password rejected → code single-use and expiring · 11 reset with wrong/expired code · 12 password policy (≥ 8) · 13 show/hide password eye · 14 enter-to-submit · 15 language switch persists · 16 Google sign-in button hidden while UI hidden; if enabled: link, sign in, **suspended account refused via Google** (see `GOOGLE_AUTH_UI_HIDDEN.md`) · 17 redirect to originally requested URL · 18 concurrent sessions · 19 CSRF/cookie flags (HttpOnly, Secure, SameSite) · 20 login page responsive + RTL.

---

## §B Business flows

Notation: `[A]` admin portal, `[C]` client portal, `[API]` direct API, `[DB]` SQL check. Oracle `D` = documented in repo (handover docs), `S` = owner/client statement. Each flow ends with **cleanup**.

### B1 Orders & fulfilment

| ID | Flow | Steps | Expected | Oracle | Pri |
|---|---|---|---|---|---|
| E2E-ORD-001 | Create inbound (admin-executed) end to end | [A] New inbound for Test company, 1 product × 5, dock + putaway plan → submit → approve → receive 5 → quality ok → putaway → complete → open GRN PDF EN/AR | Status path draft→confirmed→in progress→completed; stock +5 at planned location; ledger `inbound` row ×1; GRN numbers = lines | D F24 | P0 |
| E2E-ORD-002 | Inbound with workers | [A] create "Execute by Workers" → approve → [wh_operator] run receiving task + putaway task | Tasks appear for operator only; completion creates same ledger as admin path | D F06 | P0 |
| E2E-ORD-003 | Inbound partial receive & discrepancy | receive 3 of 5 then complete with reason | Status partially_received → completed(with discrepancy); accuracy report shows 60 % | D | P1 |
| E2E-ORD-004 | Inbound from client portal | [C] new inbound request → [A] sees "Inbound order needs approval" notification → approve | Client sees status change; notification delivered | D F39 | P0 |
| E2E-ORD-005 | Inbound validation/limits | past date, 2999 date, 0 qty, product of another client, duplicate lines, 1,000 lines | Rules enforced | C | P1 |
| E2E-ORD-006 | Cancel inbound (each status) | cancel draft/pending/confirmed; try completed | Allowed/blocked per matrix; no stock change | I | P1 |
| E2E-ORD-010 | Create outbound (admin-executed) end to end | [A] new outbound 1 line → approve (allocation) → pick → pack → shipping details (own/company) → mark complete → dispatch | Reservation on confirm; ledger out on ship; DN PDF EN/AR | D F05 | P0 |
| E2E-ORD-011 | Outbound by workers | create "Execute by Workers" → pick task → pack task → ship | Task chain | D F06 | P0 |
| E2E-ORD-012 | Outbound insufficient stock / reserved stock / lot & expiry (FEFO) | order > available; two orders competing for last unit | Message; no negative stock; no oversell (race test in IT) | D F25 | P0 |
| E2E-ORD-013 | Cancel outbound after allocation | cancel | Reservation released; stock available again | D X12 | P0 |
| E2E-OMS-001 | Create OMS order (admin) | [A] new OMS order: client (empty default), recipient Nadim Hassan, phone, governorate/city/town, address "TEST ORDER…", COD 20, 1 product → Submit for approval | Status "waiting for admin" or per rule; shipping-fee group coverage checked; order number OMS-… | D F01 | P0 |
| E2E-OMS-002 | Tolerant address matching | type "حللب", pick wrong governorate for a known town, unknown neighbourhood | "Did you mean" suggestion; order accepted with nearest; no `VALIDATION_ERROR: address neighborhood` for valid towns | S B11 | P0 |
| E2E-OMS-003 | Governorates not served by Babel (Raqqa, Deir ez-Zor, Hasakah, Suwayda) | create + confirm | Order kept; carrier list excludes Babel; routed to others/manual | S B10 | P1 |
| E2E-OMS-004 | Confirm → approve | confirm (client/admin), approve | Stock gate; reservation; fee group required, else blocked with "add rate" link | D F04 | P0 |
| E2E-OMS-005 | Ready-to-ship status and carrier choice after it | approve → pack → "Ready to ship" → choose carrier | Orders no longer sit in "processing" | S B13 | P0 |
| E2E-OMS-006 | Edit order data before/after approval; super-admin edit after shipment | change COD, qty, address | Before approval: free; after shipment: local-only warning EN+AR; carrier not notified | S B9/B14 | P0 |
| E2E-OMS-007 | Edit shipping fee / carrier cost | order detail → Edit (client fee); `adjust-carrier-cost` | Audit event; invoice and finance reflect; client never sees carrier cost | D spec | P0 |
| E2E-OMS-008 | Cancel OMS order: no shipment / with live shipment | cancel | Shipment cancelled at carrier where API exists (Sena sandbox/Sila) else manual instruction (Babel) ; reservation released; COD voided | D F10 | P0 |
| E2E-OMS-009 | Change carrier on same order | cancel carrier shipment → pick another | New AWB; old cancelled; price updated | D F11 | P1 |
| E2E-OMS-010 | Import OMS orders (xlsx template + messy file) | download template, fill, import; messy: wrong phone formats, Arabic letters, dates | Instructions sheet (AR+EN), dropdown lists (governorate→city→area); tolerant import; row errors | S B16/B22/B23 | P0 |
| E2E-OMS-011 | Batches | select 3 orders → create batch → batch page → bulk confirm shipping → out for delivery → download picking list, packing list, waybills PDF/Excel | Counters update; documents per order; picking ≠ packing layout | D F07/F08, S B17 | P0 |
| E2E-OMS-012 | Scan QR flows | scan 5 order codes in each mode (Confirm/Approve/Ready/Handover/Delivered/Failed) | Valid ones transition; invalid ones listed | D A5 | P1 |
| E2E-OMS-013 | Waybill | open waybill, English toggle, PDF, print | 10×15 cm, 2 QR, correct data | D A1 | P0 |
| E2E-OMS-014 | Group-by, filters, copy buttons | group by city/client/product/carrier/status; copy 4 values | Correct (page-scoped documented) | S B19/B20 | P2 |
| E2E-OMS-015 | Failed delivery → returned to sender → return | Sena sandbox: simulate failed, returned | OMS status failed→return pending receipt; return plan; receive; restock | D F13/F14 | P0 |
| E2E-OMS-016 | OMS ↔ outbound link: fulfilment of OMS covers its own outbound, billed once | check outbound linked OMS, invoice preview | No double billing | S owner #7 | P0 |
| E2E-OMS-017 | Inbound traceability (B3) | order detail shows source inbound orders; inbound detail lists OMS consumers | Both directions | S B3 (decision) | P1 |
| E2E-RET-001 | OMS return (plan→approve→receive→putaway) | create return for delivered order, approve, receive, put away | Stock restocked to planned location; received/putaway numbers shown; rollback rules | D F14 | P0 |
| E2E-RET-002 | Express return | express | Skips stages per rule | I | P1 |
| E2E-RET-003 | WMS return (non-OMS) | /returns new → confirm → receive → inspect → disposition → complete | Ledger by disposition; super admin tenant selector | D F14 | P1 |

### B2 Carriers (each flow ends in the carrier's own portal check — read only unless owner approves)

| ID | Flow | Expected | Oracle | Pri |
|---|---|---|---|---|
| E2E-CAR-001 Sena sandbox full cycle | create → status simulation → delivered webhook (< 10 s) → label → edit → cancel → return | All statuses mapped; tracking visible in client portal | D F12/F17 | P0 |
| E2E-CAR-002 Babel (live, owner approval per shipment) | quote → create → price equals portal → tracking poll → cancel (no API: manual instruction) | Same recipient/address/COD/price | D F18 | P0 |
| E2E-CAR-003 Sila (live, approval) | create with leaf `area_id`; COD incl. shipping; reference check before re-send; cancel `PUT /cargos/{id}/cancel`; show `error.message` + `request_id` | 9/9 guidance points | S A4, D `SILA_GUIDANCE_AUDIT.md` | P0 |
| E2E-CAR-004 Delivery Joud (live, approval) | create (POST only), Sequence number, order types, areas | Appears once in portal | D F20/I-4 | P0 |
| E2E-CAR-005 Fatih Cargo (live, approval) | create/track | adapter works | D | P1 |
| E2E-CAR-006 Carrier eligibility rules per governorate / weight / COD currency | choose destination → carrier list | Ineligible carriers hidden with reason; early warning before send | S owner #1 | P0 |
| E2E-CAR-007 Webhooks | valid, invalid signature, duplicate, out-of-order for Sena (+Sila after D-040) | Invalid → 401/ignored; duplicate idempotent; out-of-order does not regress status | D F21 | P0 |
| E2E-CAR-008 Currency: carrier prices in carrier currency/unit, converted to USD for comparison; client never sees SYP | quote compare | Best price by converted value | S owner #4/#5 | P0 |
| E2E-CAR-009 Bulk shipping modal | select 3 outbound/OMS → bulk shipping → per-order result | Partial failure reported | D F07 | P1 |
| E2E-CAR-010 Pickup address change affects next shipment | change in Shipping Companies → create | New address sent | D | P1 |

### B3 Inventory

| ID | Flow | Expected | Pri |
|---|---|---|---|
| E2E-INV-001 | Stock views and filters; lot/expiry/reservation | Available = on-hand − reserved | P0 |
| E2E-INV-002 | Adjustment increase/decrease/approve/reject | Ledger once | P0 |
| E2E-INV-003 | Internal transfer | two ledger rows | P0 |
| E2E-INV-004 | Cycle count: schedule → session → count → variance → approve | Adjustment only on approve | P1 |
| E2E-INV-005 | Warehouse + new locations (B5) | create WH → add Storage location → putaway into it | P0 |
| E2E-INV-006 | Stock per warehouse in order form (B6) | Documented behaviour (see `17`) | P2 |

### B4 Finance & billing (money — P0 everywhere)

| ID | Flow | Expected |
|---|---|---|
| E2E-FIN-001 | COD lifecycle with each of the 3 availability policies: delivered → collection confirmed → remittance confirmed | Client available balance moves exactly at policy moment; pending COD otherwise |
| E2E-FIN-002 | Shipping fee recognition timing (At dispatch vs On delivery) | Debit at the chosen event only |
| E2E-FIN-003 | Manual adjustment credit/debit | append-only, reason mandatory |
| E2E-FIN-004 | Payout request (client) → approve → disburse; minimum 10 USD; locked balance | Ledger; cannot exceed available |
| E2E-FIN-005 | B12 float on/off, reconciliation upload (match/mismatch/missing/duplicate) | Four categories; client shield hides gaps |
| E2E-FIN-006 | B15 prep-fee mode | Fee = % × order, debited while COD outstanding |
| E2E-FIN-007 | Client statement for period | opening + credits − debits = closing |
| E2E-BIL-001 | On-demand invoice preview → create → edit cells → finalise → settle from balance → cancel (returns deduction) | Matches `INVOICE_REDESIGN_SPEC.md` acceptance 1–8 |
| E2E-BIL-002 | Storage fee | $10/m³ × Σ(qty × L×W×H/1e6); missing dims warning; editable amount |
| E2E-BIL-003 | Incentive | ≥ 500 delivered OMS orders in period → −20 % fulfilment; 499/500/501 |
| E2E-BIL-004 | Charge rules per client (optional items) | Excluded items not charged |
| E2E-BIL-005 | Admin vs client invoice view | Client: no carrier cost/margin |
| E2E-BIL-006 | Orders already invoiced are skipped; OMS outbound not billed twice | Yes |
| E2E-BIL-007 | Invoice PDF EN/AR and exports | Numbers equal screen |
| E2E-BIL-008 | Plans & templates CRUD; retired cycles not nagging | per A-07 |
| E2E-FX-001 | FX: manual rate, built-in, custom HTTPS API, stale limit, min-change threshold | Active rate changes only per rules; USD only for clients |

### B5 Master data, users, admin

| ID | Flow | Expected |
|---|---|---|
| E2E-MD-001 | Product CRUD (create, edit, image, lot tracking, dimensions, archive) | list/detail/stock consistent |
| E2E-MD-002 | Client (company) CRUD + suspend + client users | Suspended → client login refused |
| E2E-MD-003 | Warehouse + locations hierarchy CRUD | Types, barcodes, deactivate guard |
| E2E-MD-004 | Shipping fee groups: create, overlap priority, uncovered warning, test price | Specific beats broad |
| E2E-USR-001 | Users per role; deactivate; password reset; worker profile | Login behaviour per role |
| E2E-USR-002 | Custom roles (O-11): create → assign → login | Only allowed actions |
| E2E-ADM-001 | Audit logs capture each action above | Rows with before/after |
| E2E-ADM-002 | Notifications generation + read state + realtime | Badge counts |
| E2E-ADM-003 | Backups: create, download (token), schedule, retention preview, health; restore/factory reset guard only (never executed) | As page cases |
| E2E-ADM-004 | Forms: public submit → admin list → delete | |
| E2E-ADM-005 | Contracts: GRN, DN, Final contract PDFs EN/AR | |

### B6 Client portal and external channels

| ID | Flow | Expected |
|---|---|---|
| E2E-CLI-001 | Login/remember-me/logout/forgot password (see AUTH battery) | |
| E2E-CLI-002 | Dashboard numbers equal own data only | tenant |
| E2E-CLI-003 | Products CRUD + image; own products only | |
| E2E-CLI-004 | Inbound request create/edit/delete (before approval) / import / export | B8: edit/cancel before EMDAD confirms; locked after |
| E2E-CLI-005 | E-commerce (OMS) orders create/import/edit/cancel before confirmation; statuses; tracking visible | B1/B8 |
| E2E-CLI-006 | Returns (e-commerce + outbound returns) create/detail | |
| E2E-CLI-007 | My profits / finances / invoices / billing (client view) | No carrier cost / margin; balances per currency rule |
| E2E-CLI-008 | Sheets: client fixed dropdown fields; editable only before admin approval; built-in hidden API credentials | S #12 |
| E2E-CLI-009 | Google Sheets connect (hidden / blocked by Google 403 until Test users set) | Documented (`O13_GOOGLE_SHEETS_403.md`) — `BLOCKED(owner action)` |
| E2E-CLI-010 | APIs page: create key, regenerate, revoke, enable/disable, docs; outgoing webhooks | S #14 |
| E2E-EXT-001 | External API `/v1/oms/orders`, `/v1/inbound/orders`, `/v1/outbound/orders` with key: create/list/get, rate limit, signature, bad key, revoked key, cross-tenant id | Per `03` IT-EXT |
| E2E-EXT-002 | Outgoing webhooks to a test receiver: status events, retry, signature | |

### B7 Cross-cutting UX flows

| ID | Flow | Expected |
|---|---|---|
| E2E-X-001 | Language switch EN↔AR on every top-level page, RTL layout | no broken layout, no untranslated keys |
| E2E-X-002 | Dark mode on every page | contrast OK, charts readable |
| E2E-X-003 | Sidebar collapse; quick jump (Ctrl+K) opens every page it lists | |
| E2E-X-004 | Browser back/forward/refresh in the middle of each wizard/form | no data loss / no duplicate |
| E2E-X-005 | Two browsers, two roles, same data (realtime) | |
| E2E-X-006 | Print/PDF outputs: picking list, packing list, waybill, GRN, DN, final contract, invoice, COD export, statement | Layout A4/10×15 correct, EN+AR |

---

## §C Modal / dialog / state inventory (screenshot each on 4 devices; assign `<seq>_<route>_<state>.png`)

Create/edit modals: new warehouse · new location · new adjustment · internal transfer · new user (warehouse/client) · new company · new plan template · schedule · charge-rule edit · rate-group editor · manual adjustment · payout approve/reject · COD set status · create batch · bulk shipping · create return / express return · assign worker · cycle-count session create.
Confirm dialogs: cancel order/shipment · delete form · deactivate warehouse/user/cutover · disconnect carrier · retention cleanup · restore · factory reset · finalise invoice · edit finalised invoice.
Scan modals: QR scanner (camera denied, camera ok, manual entry).
States: empty · loading skeleton · error · offline · 403 page · 404 page · session-expired · account-inactive (client) · maintenance.
Tooltips/menus: row ⋯ menu per status · icon-only buttons (fee-rate ✎ ▶ ⏸) · user menu · language/theme toggles · notification dropdown.
