# Sprint 2 QA Report — Core Operational Workflows

**Environment:** Staging only (`staging-client.emdadsy.com`, `staging-admin.emdadsy.com`)  
**Mode:** QA only — no application code or config changes  
**Date:** 2026-08-21  
**Actors:** `client@acme.example` (client_admin), `superadmin@emdad.example`, `testworker@example.com` (wh_operator)

---

## Executive Summary

Core OMS → Outbound (admin execution, manual shipping) → Dispatch → OMS Delivered → COD record → Return → Inbound paths are **operationally viable** on staging when exercised through the same APIs the UI calls, with inventory and idempotency behaving as documented for the task-only outbound path.

**Kane browser automation ran out of credits mid-sprint** after Phase 0 and partial Phase 1–2. Remaining phases used authenticated staging HTTP APIs + read-only DB reconciliation. UI-only items (map zoom, carrier form redundancy, import CSV UI) are marked **NOT TESTED / BLOCKED**.

| Severity | Count |
|----------|------:|
| P0 | 0 new (Sprint 1 P0s remain fixed) |
| P1 | 0 confirmed product bugs |
| P2 | 1 (see findings) |
| P3 | 0 prioritized |
| Documentation / business-rule conflicts | 2 verified |
| Environment / automation | 2 |

**Overall core workflow status:** **Mostly healthy** for admin-mode manual fulfillment + COD math + return + inbound. **Gaps:** worker UI execution, carrier full UI path, client create UI (Kane), billing line-level timing reconciliation, documents download path.

---

## Phase 0 — Previous P0 regression

### BUG-S1-001 Tasks (`/tasks`)

| Check | Result |
|-------|--------|
| Page loads | **PASS** (Kane) |
| No `useState is not defined` | **PASS** |
| Filters / table | **PASS** |
| Task detail opens | **PASS** (opened OUT-linked task) |

### BUG-S1-002 Dispatch `ready_to_ship` → `shipped`

| Check | Result |
|-------|--------|
| Admin complete-dispatch | **PASS** (API on `OUT-2026-00369`; prior Sprint 1 UI ConfirmModal verified) |
| OMS sync to shipped | **PASS** |
| Inventory decrement once | **PASS** |
| Second dispatch | **PASS** — HTTP 409 `INVALID_STATE` |

---

## OMS

### Create (client)

| Path | Result |
|------|--------|
| Kane UI create | **FAIL / AUTOMATION** — stuck on map pin / address hierarchy; second run asked user for address; no order created by Kane |
| API create `OMS-2026-02726` | **PASS** — status `waiting_for_confirmation`, no outbound |

**Pricing (API create):** qty 2 × unit 25 → `subtotal=50`, `codAmount=50`, `shippingFee=null`, `total=50` (CALC-OMS-001/002/003).

### Confirm

| Check | Result |
|-------|--------|
| Confirm → `confirmed_waiting_for_admin_approval` | **PASS** |
| Confirm twice | **PASS** (idempotent) |
| No outbound before approve | **PASS** |

### Approve

| Check | Result |
|-------|--------|
| Kane approve `OMS-2026-02723` | **PASS** (clicked Approve; DB → `processing` + `OUT-2026-00370`) |
| Kane asserted “linked outbound visible” | **FAIL / AUTOMATION** (timing; outbound existed in DB) |
| API approve `OMS-2026-02726` with `shippingFee=10` | **PASS** → `processing`, exactly one outbound `OUT-2026-00371` |
| Approve twice | **PASS** (still one outbound) |

**After fee:** `subtotal=60`, `shippingFee=10`, `codAmount=60`, `total=60`.

### Shipping fee / COD business rule

**Documented (CALC-OMS-002/003):**  
`subtotal = linesSum + shippingFee`; for COD without explicit amount, `codAmount = subtotal` (including fee on approve).

**Observed:** COD charged to recipient **includes** shipping fee (50 + 10 = 60).

**Competing expectation in sprint brief:** shipping billed to client separately; receiver not charged shipping in COD.

→ **BUSINESS RULE CONFLICT — SHIPPING FEE / COD** (not auto-classified as Product Bug). Align product owner vs docs before changing behavior.

### Delivery

| Order | Action | OMS | Outbound | COD |
|-------|--------|-----|----------|-----|
| `OMS-2026-02725` PREPAID | Mark delivered | `delivered` | **`shipped`** (unchanged) | no COD record |
| `OMS-2026-02726` COD | Mark delivered | `delivered` | **`shipped`** | `cod_records` pending **60** |
| Duplicate Mark delivered | returns success / delivered | idempotent | — | — |
| Mark delivered from `processing` | blocked `INVALID_STATE` | **PASS** | — | — |

**CONFLICT-001 verified:** OMS Delivered does **not** force outbound Delivered.

### Edit / map / carrier UI

**NOT TESTED** (Kane credits exhausted; map create path automation-limited).

### Returns

| Step | Result |
|------|--------|
| Client create return qty 1 on delivered COD | **PASS** `requested` |
| Over-return qty 5 | **PASS** blocked — remaining returnable 1 |
| Admin plan → approve → receive → putaway | **PASS** → `completed` |
| Inventory | on-hand **998 → 999** (+1) |
| OMS status after partial return | remained **`delivered`** (not fully returned) |

---

## Outbound

### Admin execution (manual) — `OUT-2026-00371` / `OMS-2026-02726`

| Stage | Result |
|-------|--------|
| Save execution plan (`executionMode=admin`) | **PASS** (shipping must stay on OMS for OMS-linked) |
| Approve → picking | **PASS** |
| Complete picking → packing | **PASS** |
| Complete packing → waiting_for_shipping_method | **PASS** |
| Select shipping method `manual` | **PASS** → waiting_for_shipping_details |
| Complete shipping details → ready_to_ship | **PASS** |
| Complete dispatch → shipped | **PASS** |
| OMS sync shipped | **PASS** |
| Dispatch idempotency | **PASS** 409 |

**Inventory (SKU-P9DZ6A-MP2IL03L):** before dispatch on_hand 1000 reserved 2 → after **998 / 0** (−2 once).

### Admin + carrier path — `OUT-2026-00369` / `OMS-2026-02725`

| Step | Result |
|------|--------|
| Carrier shipment already `created` tracking `260308475813` | Present |
| Complete shipping details → ready_to_ship | **PASS** |
| Dispatch → shipped; OMS shipped | **PASS** |
| Inventory (SKU-4QYMC6, qty 10) | 48/10 → **38/1** (remaining reserve from other order) |
| Mark delivered PREPAID | **PASS**; outbound stays shipped |

### Worker execution

| Check | Result |
|-------|--------|
| Worker login | **PASS** (`testworker@example.com` / demo123) |
| `GET /api/tasks` as worker | **PASS** (list returns) |
| Full pick/pack/dispatch UI as worker | **BLOCKED** — Kane credits exhausted |

### Allocated OMS outbound without plan

`OUT-2026-00370` (`OMS-2026-02723`) left at `allocated` with **no tasks** until plan saved — expected gate (“Approve requires a saved executionPlan”).

---

## Inbound

| Step | Result |
|------|--------|
| Client create `INB-2026-00032` qty 5 | **PASS** `pending_approval` |
| Admin plan + approve + receive + putaway | **PASS** → `completed` |
| Tasks receiving/putaway | both `completed` |
| Inventory | New **available** lot row qty **5**; sum available **1004** (was 999) — lot-tracked product |

Over-receive 105%/110% UI paths: **NOT TESTED** (CONFLICT-004 remains open).

---

## Inventory

| Journey | Before → After | Expected | Result |
|---------|----------------|----------|--------|
| Outbound dispatch COD qty 2 | 1000/2 → 998/0 | −2 on_hand, release reserve | **PASS** |
| Outbound dispatch prepaid qty 10 | 48/10 → 38/(other) | −10 on_hand | **PASS** |
| Return restock qty 1 | 998 → 999 | +1 | **PASS** |
| Inbound +5 | sum available 999 → 1004 | +5 (new lot) | **PASS** |
| Premature decrement at approve/pick | reserved only until dispatch | matches BR / CONFLICT-002 task-only | **PASS** |

---

## Billing

**Plan (Acme):** fixed subscription 10; inbound fee 10; outbound fee 10 (and other fees in snapshot).

**Invoice `INV-2026-00010` (draft):**

| Line | Qty | Unit | Total |
|------|----:|-----:|------:|
| subscription | 1 | 10 | 10 |
| inbound | 1 | 10 | 10 |
| outbound | 5 | 10 | 50 |
| **Grand total** | | | **70** |

Admin and client invoice APIs show the **same invoice number and total**.

**Reconciliation:** Cycle started 2026-08-14; line `createdAt` timestamps are cycle start — **usage quantity refresh timing vs today’s INB/OUT operations needs product-owner confirmation**. Do **not** declare billing bug solely from draft count vs today’s ops without cycle rules (`09-BILLING.md`). Marked **NEEDS VERIFICATION**.

OMS vs outbound double-count: invoice has inbound + outbound usage lines; no separate “OMS order” fee line observed on this invoice.

---

## Dashboards

| Surface | Result |
|---------|--------|
| Admin OMS dashboard API | **PASS** loads; `deliveredToday=2`, `ordersToday=2` after today’s work |
| Client `/api/client/dashboard` | **404** — wrong path / **NOT VERIFIED** in browser (Kane out of credits) |
| COD pending amounts on admin dashboard | Present (`codPending` large historical) — not fully reconciled to single order |

---

## Tasks

| Check | Result |
|-------|--------|
| Admin `/tasks` UI | **PASS** (Kane Phase 0) |
| Task creation on admin outbound stages | **PASS** (pick/pack/dispatch/receiving/putaway) |
| Worker task list API | **PASS** |
| Worker execution UI | **BLOCKED** (Kane credits) |

---

## Documents / Import-Export / Carrier UI

| Area | Result |
|------|--------|
| Delivery-note URL probed | **404** on guessed path — document download **NOT VERIFIED** |
| Import/export UI | **NOT TESTED** |
| Carrier company re-select loop / quote sensitivity | **NOT TESTED** (Kane credits; environment) |
| Weight/volume snapshot vs catalog edit | **NOT TESTED** |

---

## Auth

| Check | Result |
|-------|--------|
| Admin on client login | **PASS** blocked 403 — “only for client users” |
| Production redirect | **None observed** |

---

## Critical Findings

### P0

None new. Sprint 1 Tasks crash and dispatch blockers remain fixed under regression.

### P1

None confirmed against High-confidence docs with clean reproduction independent of automation/environment.

### P2

**BUG-S2-001 (tentative / UX)** — OMS detail after approve: Kane could not always see linked outbound number immediately (automation timing). DB linkage was correct. Severity P2 only if humans also miss the link in UI; needs human glance — **NEEDS VERIFICATION** as Product Bug.

### Business rule / documentation

1. **BUSINESS RULE CONFLICT — SHIPPING FEE / COD** — Documented COD includes `shippingFee` in subtotal; sprint brief expects shipping only on client invoice. Observed matches **documentation**, not the competing brief expectation.  
2. **CONFLICT-001** — OMS `delivered` + outbound `shipped` after Mark delivered — **confirmed**.

### Environment / automation

1. **Kane credits exhausted** after Phase 0 + partial OMS approve — blocked deep browser UI for worker, map, carrier forms, dashboards, import.  
2. Client OMS **UI create** repeatedly failed in Kane (map pin / address) — treat as **automation limitation** until human or credited Kane re-run; API create works.

---

## Coverage — intentionally incomplete

| Area | Reason |
|------|--------|
| Client map focus/zoom hierarchy | Kane stuck / ask_user |
| Worker pick/pack/dispatch UI | Kane credits |
| Carrier quote / company disappear / re-select loop | Kane credits |
| Catalog weight mutate vs order snapshot | Time / credits |
| Import/export CSV | Deferred |
| Document open/print | Endpoint not located in smoke |
| Restricted billing account creates | Not in scope data |
| Full dashboard widget reconciliation | Client dashboard path unclear; Kane blocked |
| Exact billing quantity vs all today’s ships | Cycle timing ambiguity |

Do **not** treat untested areas as passed.

---

## Traceability — key entities this sprint

| Entity | Notes |
|--------|-------|
| `OMS-2026-02725` / `OUT-2026-00369` | Carrier ship + dispatch + PREPAID delivered |
| `OMS-2026-02723` / `OUT-2026-00370` | Kane approve; outbound allocated pending plan |
| `OMS-2026-02726` / `OUT-2026-00371` | Full COD API journey + manual admin WH + deliver + COD 60 |
| Return `a20d0c2b-…` | Completed; +1 stock |
| `INB-2026-00032` | Completed; +5 available (new lot) |
| `INV-2026-00010` | Draft total 70; admin=client |

---

## Verdict

**Core operational spine works** when admin execution + manual shipping are used, including inventory-at-dispatch, OMS sync, COD record on deliver, return restock, and inbound putaway.

**Not yet proven in browser this sprint:** worker mode end-to-end, client create+map UX, carrier UX, documents, import/export, and precise billing accrual timing.

**Recommended next QA run (after Kane credits restored):** Phase 1 client create with explicit Idlib address + map pin; worker release path on a `worker` executionMode order; carrier Send Shipment UI; invoice regenerate/refresh after known ops; document print buttons from order detail.
