# CORE ORDERING, BILLING, API & IMPORT QA REPORT

**Mode:** TEST ONLY — no application code, schema, or configuration changes  
**Environment:** Staging only (`https://staging-client.emdadsy.com`, `https://staging-admin.emdadsy.com`)  
**Date:** 2026-08-21 (initial run + gap-closure continuation)  
**Actors:** `client@acme.example`, `superadmin@emdad.example`, `testworker@example.com`  
**Evidence:** `/tmp/emdad-qa/artifacts/` (+ invoice copies in this folder); Playwright + HTTPS API reconciliation  
**Prior context:** Sprint 1/2 reports + `fix-sprint-results/CORE-WORKFLOW-FIX-REPORT.md`

---

### Executive Summary

Staging can **create and reconcile** OMS / Inbound / Outbound from Client UI surfaces and APIs, with **COD = merchandise** (shipping excluded), **geo boundary auth fixed**, **multi-line import grouping**, and **API-key OMS create**. Gap-closure also proved:

- Workers dispatch → **outbound `shipped`**, OMS sync **`shipped`**, inventory on-hand **−1** for qty 1, **duplicate dispatch rejected**
- COD **generated only on Mark delivered**, Admin=Client amount, **voided on delivery revert** (record deleted)
- Historical **full return** COD → `currentAmount=0` / `returned`; **partial** pattern `60→35` (merchandise 25 returned)

Still **not accepted** for full commercial closure:

| Area | Verdict |
|------|---------|
| OMS create / confirm / approve / qty / COD math | **PASS** |
| Map geo boundary | **PASS** (HTTP 200) |
| Full browser OMS pin→submit | **PARTIAL / BLOCKED** (map automation + submit not completed in headless) |
| Inbound approve→receive→putaway | **BLOCKED** — Approve disabled until execution plan saved (plan UI not completed in automation) |
| Outbound pick→pack→ship (fresh OMS outbound) | **PARTIAL** — `OUT-2026-00374` stuck `allocated` needing execution plan; **prior** `OUT-2026-00370` completed to shipped |
| Carrier quote API | **PASS** (Babel 25000 SYP) |
| Carrier Send Shipment UI/API E2E | **NOT COMPLETED** — no order in `waiting_for_shipping_details` with carrier; Babel **connected** (not yet ENV failure) |
| Invoice “what did I pay for?” | **FAIL** — BUG-CO-001 / BUG-CO-002 |
| Export OMS | **FAIL** — BUG-CO-003 |
| Returns complete warehouse + COD adjust live | **PARTIAL** — create works; approve needs plan; historical COD math OK |
| Returns billing | **DOCUMENTATION GAP** |

**Overall:** Reliable for **intake + COD separation + dispatch inventory once + delivery COD lifecycle**. **Not** reliable/complete for **invoice transparency**, **plan-gated inbound/return completion via automation**, or **carrier send** proof.

---

### OMS

#### Creation (Client UI)
- **PASS** — form sections, name/phone rejection (`John123`, `abc123`).
- **PASS** — geo/boundary **200** after address interaction (initial run).
- Gap-closure headless pin/submit: **BLOCKED/PARTIAL** (map container/submit not found in automation). Lifecycle proven via Client API with same business fields.

#### Creation (Client API)
- **PASS** — `OMS-2026-02730`: `waiting_for_confirmation`, COD 50 for 2×25, no outbound, no shipping fee.

#### Confirmation / Approval
- **PASS** — confirm → `confirmed_waiting_for_admin_approval`; approve + fee 10 → `processing`, COD **stays 50**, subtotal 60, one outbound `OUT-2026-00374`.
- Duplicate approve → same outbound id (**PASS**).

#### Quantities / Client↔Admin
- **PASS** — qty 2 across Client, Admin, Outbound for `02730`.

#### Shipping / fulfillment
- `OUT-2026-00374`: remains **`allocated`** (needs execution plan / stage progression) — **incomplete** for fresh order.
- `OUT-2026-00370` / `OMS-2026-02723`: worker dispatch completed → outbound **`shipped`**, OMS **`shipped`**.

#### COD / delivery / revert (gap-closure)
- Before deliver: no COD record; `codGenerationStatus=none`.
- `POST .../delivered` → status `delivered`, `codGenerationStatus=ok`, COD record **originalAmount=10** (= merchandise).
- Client matches delivered + COD 10.
- Delivery revert → OMS `shipped`, `codGenerationStatus=none`, **COD record absent** (Admin list). Client order still stores `codAmount=10` field but generation cleared — **record** no longer present (collection artifact voided).

#### Return
- See Returns under COD / dedicated notes below.

---

### Inbound

| Step | Result | Evidence |
|------|--------|----------|
| Client create UI | **PASS** | `/inbound/new` |
| Client create API | **PASS** | `INB-2026-00033` pending_approval, qty 3 |
| Admin detail | **PASS** | Browser opened order |
| Save plan / Approve | **BLOCKED** | Approve button **disabled** without execution plan; API: “Approve requires a saved executionPlan” |
| Receive / putaway / inventory | **NOT COMPLETED** | Blocked on plan |
| Billing | Aggregate inbound line on invoices only | See Billing |

---

### Outbound

| Step | Result | Evidence |
|------|--------|----------|
| Client create | **PASS** | `OUT-2026-00375` pending_approval |
| OMS provision | **PASS** | `OUT-2026-00374` |
| Pick/pack (00370) | **PASS** (prior sprint UI) | Tasks completed |
| Shipping method (workers) | **PASS** (fix-sprint) | Admin select unlocked |
| Dispatch | **PASS** | Task `750175ae-…` completed; outbound `shipped` |
| Inventory | **PASS** | Stock on-hand **38→37** for ship qty **1**; reserved **8→7** |
| Duplicate dispatch | **PASS** | Second complete → `FORBIDDEN_NOT_RUNNABLE_STEP` |
| Fresh order to shipped | **NOT COMPLETED** | `00374` allocated + plan required |
| Billing | Outbound counted as aggregate qty on invoice | See Billing |

---

### APIs

- **PASS** — Client APIs page; create key `scope=oms`; secret once.
- **PASS** — External `POST /api/v1/oms/orders` → `OMS-2026-02732` with `address` object + SKU lines; system order number generated; `externalOrderId` allowed.
- **Parity:** field shapes differ from Client portal DTO (nested address, SKU vs productId; starts at `confirmed_waiting_for_admin_approval`). **P2 documentation / contract**, not create failure.
- Inbound/Outbound API scopes: **not re-exercised** in gap-closure.

---

### Import

- **PASS** — Templates use business `order_number` reference (not system UUID).
- **PASS** — Multi-line → `OMS-2026-02733` (2 rows, lines 2+1, COD 75).
- Inbound/Outbound template present; upload E2E **not** re-run in gap-closure.
- Invalid geo names → incomplete (**PASS** validation).

---

### Shipping

| Check | Result |
|-------|--------|
| Babel connected in UI/API | **PASS** |
| Real quote `POST /api/shipping/rates` | **PASS** — 25000 SYP |
| Carrier stage UI on `00374` | **BLOCKED** — not at shipping-method stage |
| Send Shipment | **NOT COMPLETED** — zero outbounds in `waiting_for_shipping_details` this run |
| Fake quote | **Not observed** on quote API |

**Note:** Not classified ENV yet — credentials appear connected; test simply did not reach Send.

---

### COD

| Check | Result |
|-------|--------|
| Amount = merchandise | **PASS** (50 vs ship 10; deliver amount 10) |
| Timing = Delivered only | **PASS** |
| Admin = Client on deliver | **PASS** |
| Revert voids COD record | **PASS** (`02726`, `02723`) |
| Full return COD | **PASS** (historical `OMS-2026-02719`: 100000→0, `returned`) |
| Partial return COD | **PASS** (historical `02726` before revert: 60→35 with return line 25; `01728`: 55→5) |
| Live return approve→COD adjust | **BLOCKED** — return approve needs execution plan (`OR-2026-00004` stuck `requested`) |

**Transition note:** Delivery revert → OMS **`shipped`** (documented), not “Out for Delivery”. Classify as **aligned with docs**, not a product bug.

---

### Billing

- `INV-2026-00010` draft: Admin+Client API **total 70** = sub 10 + inbound 1×10 + outbound 5×10.
- **No per-OMS table / shipping fee lines** → fails acceptance §§30–36 (**BUG-CO-001**).
- Client UI shows subscription + grand 70 without inbound/outbound rows (**BUG-CO-002**).
- Shipping on OMS not itemized into invoice charges.
- Return billing treatment: **DOCUMENTATION GAP**.

---

### Bugs

#### BUG-CO-001 — Invoice detail lacks OMS/Inbound/Outbound breakdown
- **Severity:** P1 | **Portal:** Admin + Client  
- **Expected:** Draft/new invoices explain OMS (with shipping), inbound, outbound.  
- **Actual:** Aggregates only; no per-OMS rows.  
- **Evidence:** `admin-inv-10.png`, `client-inv-10.png`, invoice API lines.  
- **Reproducibility:** 100% on `INV-2026-00010`.

#### BUG-CO-002 — Client invoice detail under-displays vs admin/API
- **Severity:** P1 | **Portal:** Client  
- **Expected:** Charge categories explaining total 70.  
- **Actual:** UI shows fixed subscription 10 + total 70; omits inbound/outbound rows admin shows.  
- **Evidence:** screenshots + API.  
- **Reproducibility:** 100%.

#### BUG-CO-003 — OMS export path treated as UUID
- **Severity:** P2 | **Portal:** Client API  
- **Expected:** Export file.  
- **Actual:** `GET /api/client/oms/orders/export` → `id must be a UUID`.  
- **Evidence:** curl.  
- **Reproducibility:** 100%.

#### BUG-CO-004 — (Observation) Plan gate blocks Approve for inbound/returns without clear in-flow completion in automation
- **Severity:** P2 / process | **Not elevated to P0** — product may require plan by design (`04-INBOUND`, returns docs).  
- **Actual:** Approve disabled / API rejects without execution plan.  
- **QA impact:** Prevents automated proof of receive/putaway and return completion.  
- **Classification:** Expected gate **if** documented; still an **acceptance gap** until a plan can be saved in UI and stages completed.

---

### Documentation Gaps

1. Return → invoice/billing treatment.  
2. External v1 vs Client form field parity.  
3. Whether order-level `codAmount` may remain visible after COD record void (Client still shows `codAmount=10` with `codGenerationStatus=none`).  
4. Invoice model: OMS operational cost + shipping vs outbound aggregate counts only.

---

### Environment Blockers

| ID | Issue |
|----|-------|
| ENV-S2C-001 | Puppeteer Chrome for PDFs (prior; not retested) |
| — | Carrier Send **not** proven ENV-blocked (Babel connected; stage not reached) |

---

### Remaining Risks

1. Headless browser cannot fully complete map-pin OMS submit or inbound plan forms → human/Kane pass recommended.  
2. Fresh OMS outbound (`00374`) never reached ship in this sprint.  
3. Historical COD may still include shipping in `originalAmount`.  
4. Invoice acceptance criteria unmet — commercial “what did I pay for?” risk.  
5. Return approve plan gate may leave COD unadjusted until warehouse return completes.

---

### Key entities

| Entity | Notes |
|--------|-------|
| `OMS-2026-02730` / `OUT-2026-00374` | Create→approve; outbound still allocated |
| `OMS-2026-02723` / `OUT-2026-00370` | Shipped via dispatch; delivered→COD 10→revert void |
| `OMS-2026-02732` | API-key create |
| `OMS-2026-02733` | Multi-line import |
| `INB-2026-00033` | Pending plan/approve |
| `OR-2026-00004` | Partial return requested (plan blocked) |
| `INV-2026-00010` | Breakdown FAIL |

---

### Method note

Browser-first via Playwright for portals/tasks/invoices/returns list. APIs used for reconciliation, dispatch complete after assign, COD deliver/revert, import, quotes — **not** claimed as UI pass where UI failed (e.g. map submit, inbound Approve).

---

### Final acceptance checklist

| Criterion | Met? |
|-----------|------|
| OMS/Inbound/Outbound creation | **Yes** |
| Quantity integrity (exercised paths) | **Yes** |
| Client/Admin order consistency | **Yes** (`02730`, `02723`) |
| COD correct / shipping excluded | **Yes** |
| Shipping quotes real | **Yes** |
| Carrier submission | **No** |
| Returns affect COD | **Yes** (historical + create); live complete **No** |
| API ≈ UI | **Mostly** (contract diffs) |
| Import grouping | **Yes** |
| Invoices explain charges | **No** |
| Admin/Client invoice totals | **Yes**; detail UX **No** |

**Verdict:** Core **ordering + COD + dispatch inventory** are staging-viable. **Billing invoice explainability** and **carrier send / plan-gated warehouse completion** remain open before calling the commercial system fully reliable.
