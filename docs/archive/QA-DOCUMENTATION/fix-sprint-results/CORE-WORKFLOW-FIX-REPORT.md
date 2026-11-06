# CORE WORKFLOW STABILITY & BUSINESS LOGIC FIX REPORT

**Environment:** Staging only (`staging-client.emdadsy.com`, `staging-admin.emdadsy.com`, `emdad-wms-backend-staging` / port 3001)  
**Date:** 2026-08-21  
**Scope:** Root-cause fixes for Sprint 2 Completion P0/P1 blockers + COD vs shipping separation + delivery-revert COD void

---

## 1. Executive Summary

Staging core workflows were unblocked for the two confirmed Sprint 2 Completion product bugs, and COD math was aligned to the business rule that **receiver COD = merchandise only** while **shipping fee belongs to client billing**.

| Issue | Severity | Result |
|-------|----------|--------|
| BUG-S2C-001 Client geo boundary 401 | P0 | **FIXED** — authenticated client gets 200; unauthenticated stays 401 |
| BUG-S2C-002 Workers shipping-method deadlock | P1 | **FIXED** — admin can select method on `executionMode=workers`; handoff UX added |
| COD includes shipping fee | Critical business | **FIXED** — create/approve/update derive COD from `linesSum`; COD generation no longer falls back to `subtotal` |
| Delivered → revert leaves stale COD | Critical business | **FIXED** — delivery revert voids/deletes COD record |
| Carrier send / invoice details UX / PDF Chrome | Various | **NOT fully closed** — see Remaining sections |

**Not declared “fully stable.”** Remaining gaps: full browser OMS pin journey (API geo OK), carrier live send credentials, invoice detail redesign, Puppeteer Chrome, return-billing documentation.

---

## 2. Bugs Investigated

| ID | Summary |
|----|---------|
| BUG-S2C-001 | `GET /api/client/shipping/geo/boundary` → 401 for valid client session |
| BUG-S2C-002 | After worker pack, outbound stuck at `waiting_for_shipping_method` because select-shipping-method required `executionMode=admin` |
| ENV-S2C-001 | Document PDF Create fails (Puppeteer Chrome missing) — **environment**, not product logic |
| COD / billing conflict | Docs/`CALC-OMS-003` previously equated COD to `subtotal` (incl. shipping); fix-sprint business rule requires COD = merchandise |

---

## 3. Root Causes

### BUG-S2C-001
`ClientShippingController` used `JwtClientAuthGuard` but was missing `@Public()`. Global `JwtAuthGuard` rejected client JWTs before the client guard ran. All other client controllers already use `@Public()` + `JwtClientAuthGuard`.

### BUG-S2C-002
`executionMode` means who executes warehouse **tasks** (pick/pack/dispatch). Shipping-method selection is an **admin/manager stage gate** (docs: Admin drives shipping; Operator does pick/pack/dispatch). The backend incorrectly required `executionMode=admin` for `selectShippingMethodAdmin`, while the Admin UI already showed `ShippingMethodStageCard` for workers-mode orders → permanent deadlock after pack.

### COD vs shipping
Default COD derivation used `subtotal = linesSum + shippingFee`. COD generation also fell back to `order.subtotal`. That mixed receiver collection with client shipping billing.

### Delivery revert
`revertDelivery` moved OMS to `shipped` but left any `CodRecord` in place → stale COD in portals.

---

## 4. Changes Made

1. Added `@Public()` to `ClientShippingController` (client auth unchanged; only opts out of admin JWT global guard).
2. Removed `executionMode=admin` gate from `selectShippingMethodAdmin`; role/status gates remain.
3. Admin outbound detail shows an info handoff when workers mode reaches shipping-method stage.
4. COD defaults to merchandise `linesSum` on create / approve fee / update recalculation.
5. COD generation uses `order.codAmount` only (no `subtotal` fallback).
6. `voidForDeliveryRevert` deletes COD record + resets generation flags; called from `revertDelivery`.
7. Updated `QA-DOCUMENTATION/19-CALCULATIONS-AND-DERIVED-VALUES.md` and `18-BUSINESS-RULES-AND-INVARIANTS.md` to match the COD rule.

---

## 5. Files Changed

| File | Change |
|------|--------|
| `backend/src/modules/client-portal/shipping/client-shipping.controller.ts` | `@Public()` |
| `backend/src/modules/outbound/outbound.service.ts` | Allow select-shipping-method for workers-mode orders |
| `backend/src/modules/oms/oms-orders.service.ts` | COD = linesSum; void COD on delivery revert |
| `backend/src/modules/cod/cod-records.service.ts` | No subtotal fallback; `voidForDeliveryRevert` |
| `frontend/src/components/orders/AdminOutboundOrderSummary.tsx` | Workers handoff alert |
| `QA-DOCUMENTATION/19-CALCULATIONS-AND-DERIVED-VALUES.md` | CALC-OMS-003 |
| `QA-DOCUMENTATION/18-BUSINESS-RULES-AND-INVARIANTS.md` | COD / revert note |

**Deployed on staging:** backend `npm run build` + `pm2 restart emdad-wms-backend-staging`; admin `npx vite build` → nginx root already `...-staging/frontend/dist`.

---

## 6. Database / Schema Changes

None.

---

## 7. Tests Executed

| Test | Method | Result |
|------|--------|--------|
| Client login + geo boundary (cookie / Bearer) | curl staging-client | **PASS** HTTP 200, `found: true` |
| Geo boundary unauthenticated | curl | **PASS** HTTP 401 |
| Select shipping method on `OUT-2026-00370` (`executionMode=workers`) | curl admin API | **PASS** → `waiting_for_shipping_details` |
| Complete shipping details (manual) | curl | **PASS** → `ready_to_ship` |
| Dispatch task spawned | `GET /api/tasks` | **PASS** dispatch `pending` `750175ae-…` |
| COD create: 2×25 + ship 10 | `POST /api/oms/orders` | **PASS** `subtotal=60`, `codAmount=50` (`OMS-2026-02727`) |
| Full browser map pin / OMS create UI | Kane/browser | **NOT re-run** this session (credits historically exhausted); API auth path verified |
| Carrier live Send Shipment | — | **NOT verified** (config/credentials risk) |
| Invoice detail redesign | — | **NOT implemented** |

---

## 8. Browser Verification

| Surface | Status |
|---------|--------|
| Staging admin SPA rebuilt with handoff copy | Bundle contains `Admin handoff — shipping method` |
| Staging client geo API via portal host | Verified over HTTPS |
| End-to-end visual OMS create + pin | Deferred / API-backed confidence High for auth; UI still needs human or Kane pass |

---

## 9. OMS Result

- Creation with COD + shipping fee: correct split (`OMS-2026-02727`).
- Client map boundary auth blocker removed.
- Delivery revert now voids COD (code path); full portal UI assert pending.

---

## 10. Inbound Result

No inbound-specific code changes this sprint. Prior Sprint 1/2 receiving spine not intentionally modified. **Regression not re-executed end-to-end in browser this session.**

---

## 11. Outbound Result

Workers-mode order `OUT-2026-00370` / `OMS-2026-02723` progression after pack:

`waiting_for_shipping_method` → (admin select manual) → `waiting_for_shipping_details` → (admin complete) → `ready_to_ship` + dispatch task pending.

Worker can continue Dispatch → Shipped from tasks (assign if required by list filters).

---

## 12. Shipping Result

- One admin shipping-method stage retained (Manual vs Company).
- Quote UI already uses shipping API quotes/errors (no fake success added).
- Live carrier **Send Shipment** not re-proven here.

---

## 13. COD Result

| Expected | Actual before | Fix | Verification | Result |
|----------|---------------|-----|--------------|--------|
| COD = merchandise | COD = subtotal incl. fee | Derive from `linesSum` | `OMS-2026-02727` COD 50 / subtotal 60 | **PASS** |
| Generate only on Delivered | Already gated | Unchanged | Code review | Intact |
| No subtotal fallback on generate | Fell back to subtotal | Use `codAmount` only | Code | **PASS** |
| Revert clears COD | Stale record | `voidForDeliveryRevert` | Code + call site | **PASS** (API/UI deep check pending) |

---

## 14. Return Result

Existing return COD adjustment path retained (partial negative adjustment; full → returned status). No change this sprint. **Partial/full return portal verification pending.**

---

## 15. Billing Result

No invoice calculation code changes. Shipping remains on OMS `shippingFee` / `subtotal` for client billing basis; COD no longer absorbs it.

Invoice details page redesign (OMS table + inbound/outbound summary cards) **not implemented** — classified as remaining product work.

Prior Sprint 2: `INV-2026-00010` admin↔client total 70 still the last UI reconcile point.

---

## 16. Client / Admin Consistency Result

- Same outbound status after shipping-method fix on shared order.
- COD amount now sourced from merchandise for new orders; historical orders created under old rule may still show COD=subtotal until updated/regenerated.

---

## 17. Inventory Integrity Result

No inventory code changes. Dispatch task exists for `OUT-2026-00370`; inventory decrement still expected at dispatch completion (prior invariant).

---

## 18. Carrier Integration Result

**ENVIRONMENT / CONFIGURATION** — not faked. Quotes/errors UI path unchanged. Live send not asserted this sprint.

---

## 19. Remaining Documentation Gaps

- Return impact on **billing/invoice lines** still NEEDS VERIFICATION / unspecified in docs.
- CONFLICT-001 (OMS delivered vs outbound stays shipped) unchanged.
- Invoice detail UX requirements in fix brief vs current UI — gap until implemented.

---

## 20. Remaining Environment Blockers

| ID | Issue |
|----|-------|
| ENV-S2C-001 | Puppeteer Chrome missing for document PDF generation on staging backend |
| Carrier credentials | May block live Send Shipment on staging depending on provider config |

---

## 21. Remaining Product Risks

1. Historical COD records/orders may still include shipping until corrected.
2. Invoice detail explanation UX not built.
3. Full browser OMS create (map pin → submit) not re-proven in UI this session.
4. Worker dispatch still may require admin assign depending on task list filters.
5. Broad validation consistency (phone/name across all portals) not exhaustively audited this sprint — client create already uses structured phone validation.

---

## Per-issue detail (required format)

### BUG-S2C-001 — Client geo boundary

- **Expected:** Logged-in client can load geo boundary for map focus.
- **Actual before:** 401 Unauthorized.
- **Root cause:** Missing `@Public()` on `ClientShippingController`.
- **Fix:** Add `@Public()` + keep `JwtClientAuthGuard`.
- **Verification:** Bearer/cookie → 200; no auth → 401.
- **Result:** **FIXED**

### BUG-S2C-002 — Workers shipping-method deadlock

- **Expected:** After worker pack, admin selects shipping method; workers later dispatch.
- **Actual before:** API rejected select-shipping-method unless `executionMode=admin`.
- **Root cause:** Incorrect coupling of execution mode to an admin stage action.
- **Fix:** Allow select-shipping-method for workers-mode orders; UI handoff banner.
- **Verification:** `OUT-2026-00370` → details → `ready_to_ship` + dispatch task.
- **Result:** **FIXED**

### COD excludes shipping

- **Expected:** Products 50 + shipping 10 → COD 50, subtotal 60.
- **Actual before:** COD 60.
- **Root cause:** Default COD = subtotal; generate fallback to subtotal.
- **Fix:** Default COD = linesSum; generate without subtotal fallback; docs updated.
- **Verification:** `OMS-2026-02727`.
- **Result:** **FIXED**

### Delivery revert voids COD

- **Expected:** After revert from Delivered, COD gone from admin/client; regenerable later.
- **Actual before:** Status reverted; COD record remained.
- **Root cause:** No COD void on `revertDelivery`.
- **Fix:** `CodRecordsService.voidForDeliveryRevert`.
- **Verification:** Code path; portal UI pending.
- **Result:** **FIXED (code)** / UI confirm pending

---

## Final verdict

Core P0/P1 workflow blockers from Sprint 2 Completion are fixed on **staging**, COD/shipping separation is enforced for new derivations, and workers-mode outbound is no longer stuck after pack.

The system is **not** fully accepted as “production-quality stable” until: browser OMS create+map, dispatch→shipped inventory once, return COD adjust UI, carrier send (or confirmed ENV blocker), and invoice detail UX are closed.
