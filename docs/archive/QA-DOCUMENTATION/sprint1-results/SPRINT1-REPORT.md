# Kane QA Sprint 1 — Results Report

**Environment:** Staging only  
**Client:** https://staging-client.emdadsy.com  
**Admin:** https://staging-admin.emdadsy.com  

**Mode:** TEST ONLY — no application code changes  
**Date:** 2026-08-21  

**NO PRODUCTION ENVIRONMENT WAS ACCESSED OR MODIFIED.**

---

## Executive summary

Core portals login and OMS/Inbound/Outbound **list pages** work. The OMS approve → outbound provision → warehouse progression path reached **Waiting for Dispatch / ready_to_ship** with correct OMS sync.

Two **P0** issues block completing fulfillment through the normal warehouse path:

1. **Admin `/tasks` crashes** (`useState is not defined`) — Tasks list unusable.
2. **Mark Dispatch as Complete on outbound detail does not ship** the order (status stays Waiting for Dispatch) while the Tasks route (likely intended execution path) is broken.

Client OMS/Inbound **create** via product autocomplete could not be completed reliably in automation (stuck selecting product). Treat primarily as **automation / UX friction** until reproduced manually; not filed as P0 product bug without human confirmation.

---

## Counts

| Metric | Count |
|--------|------:|
| Scenarios / runs attempted | 11 |
| Passed (objective completed as intended) | 5 |
| Failed (objective not completed) | 5 |
| Blocked / partial (automation false fail then recovered) | 1 |
| Confirmed Product Bugs (P0–P2) | 2 P0 (+ 1 P2 observation) |
| Documentation gaps / needs verification | 3 |
| Environment/configuration issues | 0 (staging reachable) |
| Automation failures (not product bugs) | 4 |

### Pass/fail by run

| ID | Phase | Result | Notes |
|----|-------|--------|-------|
| S1-SMK-C | Phase 0 Client smoke | **Pass** | Login, Online/Inbound/Outbound lists |
| S1-SMK-A1 | Phase 0 Admin smoke | Fail→**Automation** | Login succeeded; assertion timing |
| S1-SMK-A2 | Phase 0 Admin nav | **Fail → P0** | OMS/Inbound/Outbound OK; **Tasks crash** |
| S1-TSK | Tasks confirm | **Pass (bug confirmed)** | Error boundary: useState is not defined |
| S1-OMS-C | OMS create+confirm | **Fail → Automation** | Stuck on product picker |
| S1-OMS-A | OMS approve | **Pass** | OMS-2026-02724 → Processing + outbound |
| S1-OUT-1 | Outbound stages | **Partial / Fail** | Reached ready_to_ship; dispatch stuck |
| S1-OUT-2 | Dispatch retry | **Pass (negative)** | Confirmed dispatch CTA no status change |
| S1-INB-C | Inbound create | **Fail → Automation** | Stuck on product picker |
| S1-IDEM | Double approve | **Pass** | Second approve not available |

---

## P0 — Critical bugs

### BUG-S1-001 — Admin Tasks page crash (`useState is not defined`)

| Field | Value |
|-------|--------|
| Severity | **P0** |
| Module | Tasks / shared FilterPanel |
| Portal | Admin |
| Role | super_admin (seed) |
| Environment | staging-admin.emdadsy.com |
| Page | `/tasks` |
| Preconditions | Logged-in admin |
| Steps | Login → open Tasks (sidebar or `/tasks`) |
| Expected | Tasks list/filters load |
| Actual | “Unexpected Application Error! useState is not defined” — no table |
| Evidence | Kane final_state `tasks_error`; console `useState is not defined` |
| Related rules | Sprint success requires Tasks for WH path; `08-TASKS.md` |
| Cross-module impact | Blocks operator pick/pack/dispatch via Tasks UI |
| Business impact | Warehouse fulfillment via Tasks is blocked |
| Reproducibility | Confirmed 2/2 Kane runs |
| Root cause hint (for later fix sprint) | `frontend/src/components/FilterPanel.tsx` calls `useState` / React APIs **without importing from `react`** |

### BUG-S1-002 — Outbound “Mark Dispatch as Complete” does not ship order

| Field | Value |
|-------|--------|
| Severity | **P0** (combined with Tasks crash) |
| Module | Outbound |
| Portal | Admin |
| Role | super_admin |
| Page | `/orders/outbound/ecaccd89-0023-4537-85db-68e588b456ca` |
| Preconditions | Outbound **Waiting for Dispatch** / DB `ready_to_ship`; OMS also `ready_to_ship` |
| Steps | Open outbound detail → click **Mark Dispatch as Complete** (repeated; no confirm dialog) |
| Expected | Status → Shipped; inventory decrement per docs |
| Actual | Status remains Waiting for Dispatch; `shipped_ok=false`; no validation error shown |
| Evidence | Kane S1-OUT-1 / S1-OUT-2; DB still `ready_to_ship` |
| Related | BR-OUT-001, E2E-OMS-FULFILL, INV-STK-002 |
| Cross-module impact | Cannot complete OMS→Shipped→Delivered journey |
| Business impact | Fulfillment cannot finish on this path |
| Reproducibility | Confirmed |
| Classification note | May *depend* on Tasks execute path; with Tasks crashed this is a hard blocker either way |

---

## P1 — High (none newly confirmed beyond P0)

No separate P1 filed this sprint beyond the P0 blockers. OMS approve + sync to `ready_to_ship` worked.

---

## P2 — Medium / observations

### OBS-S1-001 — Outbound UI label “Planned” vs DB `allocated`

After OMS approve, Kane reported outbound status **Planned**; DB showed `allocated`.  
**Classification:** NEEDS VERIFICATION / possible display mapping — not filed as Product Bug (CONFLICT-style display).  
Confidence: Medium.

### OBS-S1-002 — Client page title mismatch during smoke

On Outbound list URL, document title still referenced Online orders (client smoke final_state).  
**Classification:** P3/cosmetic or doc title bug — deferred.

---

## Automation / not Product Bugs

| ID | Issue | Classification |
|----|-------|----------------|
| AUTO-01 | Admin smoke assertion after redirect | Automation failure |
| AUTO-02 | OMS create stuck in product listbox | Automation (possible UX friction) |
| AUTO-03 | Inbound create stuck selecting product | Automation (possible UX friction) |
| AUTO-04 | First OMS run emitted ask_user / hung | Automation / Kane |

**Recommendation:** Manual retest of client product autocomplete; if humans also cannot select products, promote to P1 UX.

---

## Documentation gaps / conflicts exercised

| ID | Topic | Outcome |
|----|-------|---------|
| CONFLICT-001 | OMS Delivered vs outbound delivered | Not reached (stuck before Shipped) |
| CONFLICT-002 | Stock decrement timing | Not fully measured (no ship) |
| Map circle recenter | OMS create | Not verified (create not completed) |
| Label Planned vs allocated | — | OBS-S1-001 |

---

## Module summaries

### OMS
| | |
|--|--|
| Critical workflow status | **Partial pass** — existing order approved; create+confirm not completed in Kane |
| Major bugs | Blocked downstream by Tasks/dispatch |
| Blockers | Product picker automation; fulfillment P0s |
| Remaining risks | Map/address not retested; Mark delivered / returns / COD not reached; import/export not run |

**Verified:** Admin approve from Confirmed→Waiting Admin Approval → Processing; shipping fee 5 applied; outbound linked; OMS later synced to `ready_to_ship` with outbound.

### Inbound
| | |
|--|--|
| Critical workflow status | **Not completed** this sprint |
| Major bugs | None confirmed |
| Blockers | Client product-line selection automation |
| Remaining risks | Approve/receive/putaway/inventory snapshots not executed |

### Outbound
| | |
|--|--|
| Critical workflow status | **Blocked at Dispatch** |
| Major bugs | BUG-S1-001, BUG-S1-002 |
| Blockers | Tasks crash + dispatch CTA ineffective |
| Remaining risks | Pick/pack/shipping method path largely progressed once (reached ready_to_ship) — good until final step |

**Verified:** Progression to Waiting for Dispatch; OMS↔Outbound sync to ready_to_ship; second OMS approve not available (idempotent UX).

---

## Inventory / calculations

| Check | Result |
|-------|--------|
| Stock snapshots across ship | **Not done** — no ship |
| Subtotal/COD math on new create | **Not done** — create incomplete |
| OMS fee on approve | Fee 5 applied (Kane summary) — light pass |

---

## What was deferred (by design)

- Profile/cosmetic UI  
- Full returns / COD after deliver  
- Import/export/API deep tests  
- Carrier Send Shipment  
- Billing cycle math  
- Negative over-receive  
- Parallel multi-user realtime  

---

## Recommended next actions (for a later fix sprint — not this run)

1. Fix `FilterPanel.tsx` React imports → unblock `/tasks`.  
2. Investigate why Mark Dispatch as Complete does not transition `ready_to_ship` → `shipped` from outbound detail (wire to same service as task complete, or require Tasks with clear UX).  
3. Manual QA of client product autocomplete.  
4. Re-run Sprint 1 Phase D–F after fixes: ship → Mark delivered → inventory snapshot → return.

---

## Artifact paths

Kane result JSON under:

`QA-DOCUMENTATION/sprint1-results/`

Including: `phase0-client.json`, `phase0-admin*.json`, `bug-tasks-usestate.json`, `phase1-oms-*.json`, `phase3-*.json`, `phase2-inbound-create.json`, `phase-f-idempotency.json`.
