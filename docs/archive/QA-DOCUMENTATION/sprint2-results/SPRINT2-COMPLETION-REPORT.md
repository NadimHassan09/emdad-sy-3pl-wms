# Sprint 2 Completion Report — Browser-First UI Gap Closure

**Environment:** Staging only (`staging-client.emdadsy.com`, `staging-admin.emdadsy.com`)  
**Mode:** QA only — no application code changes  
**Date:** 2026-08-21  
**Prior context:** `SPRINT1-REPORT.md`, `SPRINT2-REPORT.md`  
**Actors:** `client@acme.example`, `superadmin@emdad.example`, `testworker@example.com`

---

### Executive Summary

Browser-first retesting closed several Sprint 2 UI gaps and surfaced **two confirmed Product Bugs** that block core UI journeys:

1. **P0 — Client map geo boundary unauthorized** — `GET /api/client/shipping/geo/boundary` returns **401** for valid client sessions because `ClientShippingController` is missing `@Public()` (unlike all other client controllers). Map focus/pin workflow cannot complete; OMS create via Client UI remains blocked.
2. **P1 — Workers-mode outbound stuck after pack** — After worker UI pick+pack succeed, outbound enters `waiting_for_shipping_method`, but `select-shipping-method` requires `executionMode=admin`, so no shipping-details/dispatch tasks are created. Worker fulfillment cannot finish to Shipped.

**Worker pick + pack UI: PASS.** Billing invoice UI (admin + client) for `INV-2026-00010` total **70: PASS**. Documents Create PDF: **FAIL / ENVIRONMENT** (Puppeteer Chrome missing on staging backend). Carrier full UI and full import/export: **not completed** this run.

| Severity | Count |
|----------|------:|
| P0 Product Bugs | 1 |
| P1 Product Bugs | 1 |
| P2 | 0 new confirmed |
| Documentation gaps | 1 (map zoom precision) |
| Environment / configuration | 1 (PDF Chrome) |
| Automation failures | several (plan form, UUID truncation) |

---

### Tests Completed

| Area | Evidence |
|------|----------|
| Client OMS create UI (attempted) | Kane ×2; geo boundary 401 reproduced with client JWT |
| Map / address hierarchy | Address selectors work; map boundary API fails → pin workflow broken |
| Worker login + Tasks | Kane PASS |
| Worker pick UI (`OUT-2026-00370`) | Kane PASS — Start + Complete picking |
| Worker pack UI | Kane PASS — Start + Complete packing |
| Admin billing invoice UI | Kane opened `INV-2026-00010` |
| Client billing invoice UI | Kane PASS — grand total **70** |
| Documents UI action | Kane clicked Create PDF Delivery Note on shipped outbound |
| Workers shipping-method gate | API + status evidence after pack |

### Tests Blocked / Incomplete

| Area | Reason |
|------|--------|
| Client OMS submit + confirm (UI) | P0 geo auth blocks map pin requirement |
| Worker shipping details + dispatch UI | P1 workers-mode shipping-method deadlock |
| Carrier company/quote/send UI end-to-end | Not reached; credits spent on P0/P1 paths |
| Import valid/invalid CSV execute | UI smoke incomplete (Kane hang after docs) |
| Export file content validation | Not tested |
| Documents PDF open success | Staging Puppeteer Chrome missing |
| Dashboard widget deep reconcile | Deferred (P2) after blockers |

---

### Confirmed Product Bugs

### P0

#### BUG-S2C-001 — Client shipping geo boundary returns 401 (map create blocked)

| Field | Detail |
|-------|--------|
| Severity | **P0** |
| Module | Client OMS / Shipping geo |
| Portal | Client |
| Role | client_admin |
| Environment | Staging |
| Page | `/ecommerce-orders/new` |
| Preconditions | Logged-in client; valid address hierarchy |
| Exact steps | 1) Login client 2) New online order 3) Select governorate/city/neighborhood 4) Observe map / network |
| Expected | Authenticated client can load area boundary; map focuses; pin can be placed per docs (`03-CLIENT-PORTAL.md`) |
| Actual | `GET /api/client/shipping/geo/boundary?...` → **401 Unauthorized** (Kane + curl with valid client Bearer/cookie) |
| Root cause (implementation) | `ClientShippingController` has `@UseGuards(JwtClientAuthGuard)` but **missing `@Public()`**, so global `JwtAuthGuard` (internal JWT) rejects client tokens. Peer controllers (OMS/inbound/etc.) all use `@Public()` + `JwtClientAuthGuard`. |
| Evidence | Kane run summary (401 on geo/boundary); curl reproduce; source diff vs `ClientOmsOrdersController` |
| Reproducibility | 100% |
| Business impact | Client cannot complete documented map-pin OMS create through UI |
| Related | Sprint 2 classified create failures as automation; this run proves **application auth bug** |
| Cross-module | Blocks OMS UI create → confirm journey |

### P1

#### BUG-S2C-002 — Workers execution mode cannot select shipping method after pack

| Field | Detail |
|-------|--------|
| Severity | **P1** |
| Module | Outbound / Tasks / Shipping |
| Portal | Admin (worker + admin APIs) |
| Role | wh_operator / admin |
| Environment | Staging |
| Entity | `OUT-2026-00370` / `OMS-2026-02723` |
| Preconditions | `executionMode=workers`; pick+pack completed via worker UI |
| Exact steps | 1) Worker completes pack 2) Outbound status `waiting_for_shipping_method` 3) `POST /outbound-orders/:id/select-shipping-method` with Manual |
| Expected | Documented path can reach shipping details → dispatch → shipped (worker or admin handoff clearly defined) |
| Actual | API: `BAD_REQUEST` — `select-shipping-method requires executionMode=admin.` No `shipping_details` / `dispatch` tasks created. Worker Tasks show no shipping tasks for the order. UI still shows Shipping Method card on outbound detail. |
| Evidence | DB status `waiting_for_shipping_method\|workers\|manual`; API error; Kane worker search found no shipping tasks |
| Reproducibility | Confirmed on this order |
| Business impact | Worker fulfillment **cannot finish** to Shipped after successful pick/pack |
| Related | `05-OUTBOUND-WORKFLOW.md` shipping method stage; `outbound.service.ts` `selectShippingMethodAdmin` guard |
| Cross-module | Blocks OMS sync to ready_to_ship/shipped for workers-mode orders |

### P2 / P3

None additional confirmed this sprint beyond the above.

---

### Documentation Gaps

- Exact map zoom levels after hierarchy selection remain **DOCUMENTATION GAP / NEEDS VERIFICATION** (cannot validate while boundary API 401s).
- Workers-mode ownership of “Select Shipping Method” (admin vs task) is under-specified relative to the admin-only API guard — treat as doc/product alignment need once BUG-S2C-002 is fixed.

### Automation Failures

- Kane often submitted OMS form without successful pin (initially misclassified; later proven geo 401).
- Admin warehouse plan form fill (warehouse/dock) unreliable in Kane → fixture used API plan/confirm for worker path setup only.
- Long task UUID in URL truncated by Kane navigation → Task not found until search/assign used.
- Unassigned pending tasks not visible in worker default list until admin **assign** (may be by design — note for QA setup).

### Environment/Configuration Issues

#### ENV-S2C-001 — Document PDF generation missing Chrome

- Kane clicked **Create PDF** (Delivery Note EN) on shipped `OUT-2026-00371`.
- Backend log: `DocumentGenerationService` / `POST /api/documents/dn/...` — **Could not find Chrome (Puppeteer)**.
- Classification: **ENVIRONMENT / CONFIGURATION** (not a business-rule bug). Blocks document download success until Chrome installed for staging backend.

---

### Client OMS UI

**Result: FAIL**

Blocked by BUG-S2C-001. Product search/selection steps were reachable in Kane; submit did not create an order. No Waiting for Confirmation via UI this run.

### Map / Address

**Result: FAIL**

Address hierarchy selection works. Map boundary load fails (401). Pin placement cannot be verified as successful. Map focus/zoom **not verified** (blocked).

### Worker UI

**Result: PARTIAL**

| Step | Result |
|------|--------|
| Login | PASS |
| Tasks list | PASS |
| Pick | PASS (UI) |
| Pack | PASS (UI) |
| Shipping method / details | FAIL / blocked (BUG-S2C-002) |
| Dispatch | NOT REACHED |
| Inventory once at dispatch | NOT REACHED (on-hand still reserved for open order) |

**Note:** Plan/release + task assign used API as **fixture prep** after Kane failed plan UI; pick/pack themselves were browser UI.

### Carrier UI

**Result: BLOCKED / NOT TESTED**

Not executed end-to-end in this completion sprint (priority consumed by P0/P1). Sprint 2 already had API carrier shipment evidence on another order — not counted as UI pass here.

### Import / Export

**Result: PARTIAL / BLOCKED**

OMS Import button existence was in the Kane billing/docs objective but the run hung after document PDF attempt. Full valid/invalid import and export content checks **not completed**. Do not claim PASS.

### Documents

**Result: FAIL (environment)**

UI exposes Create PDF for Delivery Note. Click reaches backend; generation fails due to missing Puppeteer Chrome (ENV-S2C-001).

### Billing

**Result: PASS (visibility + total consistency)**

| Check | Result |
|-------|--------|
| Admin open `INV-2026-00010` | PASS (Kane) |
| Client open `INV-2026-00010` | PASS — grand total **70** |
| Admin/client total match | PASS (70) |
| Cycle timing vs today’s ops | Still **NEEDS VERIFICATION** per `09-BILLING.md` (not declared a bug) |

### Cross-Module Reconciliation

**Result: PARTIAL**

| Journey | Result |
|---------|--------|
| Worker pick→pack | Tasks advance; outbound → `waiting_for_shipping_method`; inventory not decremented yet (correct) |
| Worker → shipped | Blocked by BUG-S2C-002 |
| Client OMS UI create | Blocked by BUG-S2C-001 |
| Billing totals admin↔client | PASS for INV-2026-00010 |

---

### Remaining Risks

1. Client OMS create UI remains unusable until geo `@Public()` (or equivalent auth) is fixed and retested with map pin.
2. Workers-mode shipping method handoff must be fixed/clarified before claiming worker E2E to Shipped.
3. Staging document PDFs will keep failing until Chrome is installed for the backend process user.
4. Carrier UI, import/export execution, and dashboard deep reconcile remain open.
5. Kane plan-form automation remains weak — human or improved selectors needed for release UI proof.

---

### Recommended next fix sprint (out of QA scope)

1. Add `@Public()` to `ClientShippingController` (match other client controllers); retest map + OMS create UI.
2. Allow shipping-method selection for `executionMode=workers` (or enqueue an admin/worker task); retest worker → shipped + inventory once.
3. Install Puppeteer Chrome on staging backend; retest Delivery Note / GRN Create PDF.

---

### Key entities

| ID | Notes |
|----|-------|
| `OUT-2026-00370` / `OMS-2026-02723` | Workers mode; pick+pack UI done; stuck at shipping method |
| Pick `4bad9707-…` / Pack `9400ad67-…` | Completed by worker UI |
| `INV-2026-00010` | Admin + client UI total 70 |
| `OUT-2026-00371` | Document Create PDF attempted (Chrome fail) |
