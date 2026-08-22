# 22 — Documentation Conflicts

Conflicts found while strengthening the QA package. Do **not** silently pick a side in Kane runs—verify on staging and record evidence.

---

## CONFLICT-001 — OMS Delivered vs Outbound Delivered

### Documents involved
`06-OMS-WORKFLOW.md`, `05-OUTBOUND-WORKFLOW.md`, `18-BUSINESS-RULES-AND-INVARIANTS.md`, `20-CROSS-MODULE-INVARIANTS.md`

### Conflicting statements
- Commercial OMS Delivered is admin Mark delivered.
- Outbound enum includes `delivered`, but outbound→OMS sync does **not** set OMS delivered; Mark delivered does not clearly set outbound delivered.

### Implementation evidence
`mapOutboundStatusToOms` returns null for outbound `delivered`; `markDelivered` focuses on OMS + COD.

### Current confidence
High that OMS Delivered ≠ automatic outbound Delivered sync.

### Recommended verification
After Mark delivered, open outbound detail: note actual outbound status. Do not fail solely because outbound is not Delivered unless product owner requires it.

---

## CONFLICT-002 — Inventory Change Timing (Approve vs Dispatch)

### Documents involved
Older narrative in `07-INVENTORY.md` (“timing depends on stage”) vs `18`/`20` task-only dispatch decrement.

### Conflicting statements
Vague “availability changes as orders progress” vs precise “decrement at dispatch under task-only.”

### Implementation evidence
`TASK_ONLY_FLOWS` / task inventory effects decrement on dispatch; approve soft-reserves only when allocate enabled.

### Current confidence
High for task-only path; Low if staging flags differ.

### Recommended verification
Confirm staging feature flags; snapshot stock across approve/pick/ship.

---

## CONFLICT-003 — Billing Restriction: UI vs Backend for OMS/Returns

### Documents involved
`03-CLIENT-PORTAL.md`, `09-BILLING.md`, `18` BR-BIL-001/003

### Conflicting statements
Portal disables all creates when restricted; backend asserts billing only for inbound/outbound/product create—not OMS/returns.

### Implementation evidence
`BillingAccessService` usage matrix from billing reverse-engineer.

### Current confidence
High that gap exists.

### Recommended verification
With restricted account, UI create disabled; if testing API outside Kane browser scope, note separately. Kane should treat UI disable as expected; API bypass is a **consistency/security gap** if reproducible.

---

## CONFLICT-004 — Over-Receive 100% vs 110%

### Documents involved
`13-ERRORS-AND-VALIDATION.md` (110% message), inbound workflow, `18` BR-INB-002

### Conflicting statements
DB allows up to 110%; some app receive paths reject above 100%; short-close may bypass app check.

### Implementation evidence
DB trigger 1.10; legacy/task validators differ.

### Current confidence
Medium which UI path Kane hits.

### Recommended verification
Attempt 105% and 115% on the actual receiving UI used in staging; record which errors appear.

---

## CONFLICT-005 — Client Outbound “Shipped” Includes Delivered

### Documents involved
`03-CLIENT-PORTAL.md`, `05-OUTBOUND-WORKFLOW.md`

### Conflicting statements
Client collapses `shipped` and `delivered` to label **Shipped**.

### Implementation evidence
Client status display mapping.

### Current confidence
High this is intentional display collapse—not necessarily a bug.

### Recommended verification
Do not report as bug unless admin outbound delivered is expected to show a distinct client label.

---

## CONFLICT-006 — Reject vs Cancelled Badge

### Documents involved
`06-OMS-WORKFLOW.md`, transitions doc

### Conflicting statements
Admin Reject may store rejection fields but transition target is **cancelled**.

### Implementation evidence
`reject` → `cancelled` + rejection metadata.

### Current confidence
High.

### Recommended verification
After Reject, accept Cancelled (or Rejected if UI maps specially)—confirm actual badge text before filing UI bugs.

---

## CONFLICT-007 — Billing Summary Status vs Access Status

### Documents involved
`09-BILLING.md`

### Conflicting statements
Company `active` without live cycle: access API may say `restricted` / operationalAllowed false while some summary UI may still say active.

### Implementation evidence
`deriveAccountStatus` vs `BillingAccessService` differences.

### Current confidence
Medium–High.

### Recommended verification
Compare Billing page banner vs ability to create orders.

---

## CONFLICT-008 — Shipping Details Task Spawn After Method Selection

### Documents involved
`05-OUTBOUND-WORKFLOW.md`, `08-TASKS.md`, shipping reverse-engineer

### Conflicting statements
Workflow implies shipping_details task after method; spawnable status set may omit `waiting_for_shipping_method`, so worker task may be missing while admin CTA still works.

### Implementation evidence
Orchestration spawnable set notes.

### Current confidence
Medium.

### Recommended verification
After selecting method, check Tasks list for shipping_details; admin complete path may still work.

---

## How Kane should use this file

1. Prefer **High** confidence rules in `18`–`21` for bug calls.
2. For items listed here, verify on staging before filing a product bug.
3. Cite this conflict ID in the report when behavior matches one side of a documented tension.
