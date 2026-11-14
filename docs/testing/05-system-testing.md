# 05 — System testing (end-to-end business correctness)

System testing asks: **does the whole system behave sensibly as a business tool?** Not "does the button work" but "is the number right, is the state legal, does it make sense for the owner and client". It uses the UI, the API and SQL together, and it is where wrong *assumptions* are found — so every case states its **oracle** (S owner/client · D doc · C code · I inferred → `17`).

---

## 1. State-machine matrices (generate the real matrix from code, then execute every cell)

For each entity the executor builds the table *status × action × role* from `*.service.ts` and from the UI (button visible/enabled) and compares **three views**: service rules, API response, UI controls. A mismatch between any two is a defect.

| ID | Entity | Statuses to cover (from UI/DB) | Cell types |
|---|---|---|---|
| SYS-SM-001 | OMS order | waiting for confirmation, waiting for admin, processing, ready to ship, out for delivery, delivered, failed delivery, return pending receipt, return received, cancelled (+ `waiting_for_shipping_details` as warehouse status) | action: confirm, approve, pick/pack, ready, ship/handover, deliver, fail, return, cancel, edit (client / admin / super admin), change carrier, cancel shipment |
| SYS-SM-002 | Outbound | draft, pending approval, confirmed, allocated, picking, packing, waiting for shipping details, shipped, cancelled | approve, allocate, pick, pack, complete shipping details, ship, cancel, edit |
| SYS-SM-003 | Inbound | draft, pending approval, confirmed, in progress, partially received, completed, cancelled | approve, receive, quality, putaway, complete, cancel, edit |
| SYS-SM-004 | OMS return | pending, received, rejected, cancelled (+ stages plan/approve/receiving/putaway) | approve, receive, put away, reject, cancel, rollback ×2 |
| SYS-SM-005 | WMS return | draft, confirmed, receiving, inspecting, completed, cancelled | |
| SYS-SM-006 | Task | created, assigned, in progress, completed, cancelled | assign, start, complete, reassign |
| SYS-SM-007 | Adjustment | draft, pending, approved, rejected | |
| SYS-SM-008 | Cycle count | planned, in progress, variance review, approved, closed | |
| SYS-SM-009 | Invoice | draft, unpaid, paid, cancelled (+ finalised/locked flag) | finalise, edit, mark paid, settle from balance, cancel |
| SYS-SM-010 | COD record | pending, available, paid out, returned | collect, remit, set status, void on cancel |
| SYS-SM-011 | Payout | requested, approved, disbursed, rejected, cancelled | |
| SYS-SM-012 | Client account | active, restricted, suspended | effect on login, create-order, billing restriction banner |
| SYS-SM-013 | User | active, inactive, suspended | login (password + Google), sessions |
| SYS-SM-014 | Carrier shipment | created, picked up, in transit, out for delivery, delivered, failed, returned, cancelled | mapping per carrier → internal status never regresses on out-of-order webhook |
| SYS-SM-015 | Backup job | running, completed, failed, expired | cleanup, download |

Pass criteria: every forbidden cell returns the documented error code and **leaves state, stock, finance and audit untouched** (checked with SQL snapshot diff).

---

## 2. Money — worked scenarios with numbers (all P0)

Each scenario is executed UI → API → SQL; the expected numbers below are *computed by hand by the test author and approved by the owner before use* (`17`: A-18 rounding, A-19 display format).

### 2.1 Invoice reconciliation using existing staging data

Existing cancelled invoice **INV-2026-00026** (Test company) shows: inbound INB-…62 = $12.75, INB-…63 = $2.75, OMS-…3720 fulfilment $3.25 + EMDAD shipping $4.00, header amount **25.75 USD**.
Σ visible lines = 12.75 + 2.75 + 3.25 + 4.00 = **22.75**; header says **25.75** → **$3.00 unexplained** (storage? manual line? rounding?). `SYS-BIL-001`: reproduce the sum from the DB lines and explain the difference; fail if not explainable. (Defect candidate V-039.)

### 2.2 Scenario table

| ID | Scenario | Inputs | Expected |
|---|---|---|---|
| SYS-BIL-002 | On-demand invoice for a fresh client: 2 inbound (plan price $2.75 each + $0.25/unit?), 3 outbound, 4 OMS orders, storage 0.45 m³ | choose plan values explicitly in the test | line-by-line expected table written in the test; totals; margin = client total − Σ carrier cost |
| SYS-BIL-003 | Storage: SKU A 100 pcs 30×20×10 cm; SKU B 50 pcs 40×40×40 cm; SKU C no dims | CBM = 100×0.006 + 50×0.064 = 0.6 + 3.2 = **3.8 m³** → × $10 = **$38.00**, C flagged "missing dimensions" | exact |
| SYS-BIL-004 | Incentive: client with exactly 500 delivered OMS orders in period, fulfilment total $1,000 | discount −$200.00 (20 %); at 499 → none and message "need 1 more" | exact |
| SYS-BIL-005 | Carrier cost correction: quote $3.50 → actual $4.20 via adjust-carrier-cost | invoice margin drops $0.70; audit row old/new/reason; client invoice unchanged | |
| SYS-BIL-006 | Shipping fee edit: client fee $5 → $6 | order, invoice, client portal order, finance shipping-fee transaction all show $6 (policy-timed) | write-through to all 4 places |
| SYS-BIL-007 | Invoice finalise → cells lock → admin "Edit invoice" → change → audit entry → totals recomputed | | |
| SYS-BIL-008 | Settle from balance: client balance $100, invoice $25.75 | balance $74.25; transaction `fulfillment_fee` debit; cancelling the invoice returns $25.75 (see TXN-20261103-114FF0 pattern) | |
| SYS-BIL-009 | Order on two overlapping invoice periods | second preview skips it | |
| SYS-BIL-010 | Zero-activity period | invoice blocked or $0 invoice per rule (A-20) | |
| SYS-BIL-011 | Rounding: 3 lines of $0.333… | Σ rounded lines = rounded Σ (document tolerance) | |
| SYS-FIN-001 | COD order $20 delivered by Sena (sandbox) under policy "On carrier remittance": pending $20 → collect → remit → available $20 − shipping fee − other debits | balances at each step | |
| SYS-FIN-002 | Same under "On collection confirmation" and "Immediately on delivery" | moment of availability differs | |
| SYS-FIN-003 | Return after COD credited (policy c) | COD reversed, shipping fee kept? return fee rule (A-21 decision pending) | |
| SYS-FIN-004 | Prep fee 2 % on COD $20 outstanding | −$0.40 while outstanding; refunded if order cancelled before delivery? (A-05) | |
| SYS-FIN-005 | Pending COD shown as "$85000.00" for Madino whose COD is in SYP | currency conversion shown or labelled SYP; Σ overview = Σ accounts (V-040 candidate: finance overview mixes currencies) | |
| SYS-FIN-006 | Payout $10.00 exactly (minimum) and $9.99 | accepted / rejected | |
| SYS-FIN-007 | Client statement for period equals admin transactions filtered by client | | |
| SYS-FIN-008 | Float: 3 shipments in transit with carrier cost USD 3.5/SYP 12,000/new SYP 130 → in-transit float in USD at active rate | exact; alert when > limit 5,000 | |

### 2.3 Currency rules (S: owner decisions 5–9 Nov)

| ID | Rule | Test |
|---|---|---|
| SYS-CUR-001 | Inside EMDAD everything is USD; clients and invoices USD only | scan all client endpoints + client UI for "SYP"/"ل.س" |
| SYS-CUR-002 | New SYP exists only toward carriers; old SYP retired (1 new = 100 old) | carrier forms accept/emit carrier unit; batch cost card shows "SYP quotes 0 SYP / Total (SYP) 24,702" — verify unit and rate (1 USD = 13,001 old SYP) against settings (130.01 new SYP) (V-041) |
| SYS-CUR-003 | Best carrier chosen by converted value | quotes in 3 units |
| SYS-CUR-004 | FX stale/threshold/manual semantics | change rate; recalc open quotes? (A-08) |
| SYS-CUR-005 | Rate displayed everywhere equals active rate at the time (history preserved) | |

---

## 3. Inventory semantics

| ID | Scenario | Expected |
|---|---|---|
| SYS-INV-001 | Create inbound 100, outbound 30 (reserved), ship 30, return 5 restocked, adjust −2 | on-hand 73? Provide the exact ledger table; available/reserved at each step match stock page and reports (Inventory, Reserved, Product moves) |
| SYS-INV-002 | Stock page "Available stock" vs product detail "On hand / Reserved 10000 / 8" vs Inventory report | all equal |
| SYS-INV-003 | Lot/expiry FEFO: two lots, order consumes earliest expiry first | allocation report shows lot |
| SYS-INV-004 | Stock shown in OMS order form is for which warehouse (B6) | documented + tested |
| SYS-INV-005 | Warehouse capacity/CBM utilisation report vs locations | |
| SYS-INV-006 | Negative/over-allocation impossible under every UI path (admin, worker, client API, import) | |
| SYS-INV-007 | Cycle count variance vs ledger | |
| SYS-INV-008 | New warehouse → location → putaway works (B5) | |

---

## 4. Cross-module consistency (the class of bugs the screenshot pass already hinted at)

| ID | Check | Why / seen |
|---|---|---|
| SYS-X-001 | Carrier shown on OMS detail equals carrier on linked outbound and on shipment record | OMS-2026-03729 shows carrier "مرسال" (tracking 100554961267) while OUT-2026-04466 says SILA_SY with a UUID AWB (V-042) |
| SYS-X-002 | Counts equal across: OMS list status cards, OMS dashboard, reports (merchant orders), batch counters, finance overview | |
| SYS-X-003 | Same order's amounts equal across: order detail, waybill (COD 20 USD, shipping 5 USD), invoice, finance transaction, client portal, COD list | OMS-…3729: lines 20, shipping rate 5, carrier quote 3.5, subtotal 25, COD 20 — is subtotal 25 = 20 + 5 and COD 20 (excluding shipping)? (A-22) |
| SYS-X-004 | Notifications reflect real state (no legacy cycle notices; billing/dashboard widgets) | V-043 |
| SYS-X-005 | Audit log has entry per business action; noise (`AUTH REFRESH REPLAY`) doesn't hide them | |
| SYS-X-006 | Timezone: all timestamps shown in Asia/Damascus (or browser?) consistently; DB UTC; cron "01:18" schedule | A-23 |
| SYS-X-007 | Language parity: every number, date, status in Arabic UI | |
| SYS-X-008 | Terminology: Inbound/GRN/Receipt, Outbound/DN, "Field Delivery" wording, "Auth group", "Cutover", "Legacy billing" | glossary approved by owner |
| SYS-X-009 | RBAC UI == RBAC API (every button hidden for a role is also forbidden by API, and vice-versa) | |
| SYS-X-010 | Removing something referenced (warehouse with stock, product with history, client with orders, carrier connected) | blocked with explanation |

---

## 5. Non-functional scenarios at system level

| ID | Scenario | Expected |
|---|---|---|
| SYS-NF-001 | Day-in-the-life: 50 OMS orders created via import → confirmed → batched → shipped (Sena sandbox) → delivered → COD → invoice → client statement; run on staging with timing | total time, no stuck state, all invariants (IT-INV) green |
| SYS-NF-002 | Restart staging backend mid-flow (PM2 restart) | no lost/duplicated work; sessions survive |
| SYS-NF-003 | Backup → modify → restore into scratch → compare | |
| SYS-NF-004 | Clock/timezone edge: 23:59 / 00:00 boundaries for invoices, reports, retention | |
| SYS-NF-005 | Upgrade path: deploy new build while users logged in (update modal), cached assets | no white screen |
| SYS-NF-006 | Data volume: 4,320 OMS / 3,608 outbound already present — lists, reports, exports still fast | see `08` |

---

## 6. Reporting rule for this file

For each executed case the report states: **what the system did (numbers)**, **what was expected and why (oracle)**, **assumptions** (A-ids). A case that passes only because the test author's assumption matched the code (e.g. subtotal semantics) is marked `PASS(assumption A-xx)` so the owner can overturn it.
