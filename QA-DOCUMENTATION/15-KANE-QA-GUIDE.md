# 15 — Kane / Browser QA Agent Guide

**Audience:** External browser QA agents (Kane CLI or similar) and humans driving the same process.

---

## Mission

Compare:

```text
DOCUMENTED EXPECTED BEHAVIOR  vs  ACTUAL UI BEHAVIOR
```

You are a **real user**. You do **not** read application source code, databases, or network payloads unless the product UI itself shows them (for example an on-screen error message).

---

## Operating rules

1. Interact only through the browser UI (click, type, navigate, upload).
2. Do not assume implementation details (APIs, Prisma, React state).
3. Prefer visible outcomes: status badges, list rows, banners, PDFs, disabled buttons.
4. Test positive paths and negative paths from `14-QA-SCENARIO-MATRIX.md`.
5. Run cross-module End-to-End scenarios, not only single-page checks.
6. Capture evidence on failure: screenshot, URL, user role, steps, expected vs actual.
7. Classify each failure:

| Classification | When to use |
|----------------|-------------|
| **Product bug** | UI contradicts High-confidence documented expected behavior |
| **Unexpected behavior** | Differs from Medium-confidence docs; needs human judgment |
| **Environment / configuration** | Carrier credentials, feature flags, missing seed data, email not configured |
| **Authentication / permission** | Wrong role, expired session, restricted billing account |
| **Doc gap** | Behavior is coherent but undocumented or marked UNKNOWN |

8. Never report a bug solely because reality differs from your assumption. Prefer the documentation package; if docs say UNKNOWN, investigate and report as **needs verification**, not as a confirmed bug.
9. Do not “fix” the product. Report only.
10. Respect staging vs production: use staging URLs unless explicitly told otherwise.

---

## Suggested reading order per run

1. `README.md` — scope & uncertainty
2. `00-SYSTEM-OVERVIEW.md` — lifecycle
3. `01-AUTHENTICATION-AND-ROLES.md` — who you are in this run
4. Portal file: `02-ADMIN-PORTAL.md` or `03-CLIENT-PORTAL.md`
5. Workflow file for the module under test
6. `14-QA-SCENARIO-MATRIX.md` — pick IDs
7. `13-ERRORS-AND-VALIDATION.md` — for negative expects
8. This guide — classification rules

---

## Account & data preconditions

Before a scenario:

- Confirm actor role matches the scenario (admin manager vs operator vs client_admin vs client_staff).
- Confirm billing account is **Active** unless the scenario tests Restricted.
- Confirm products and stock exist when ordering.
- For carrier tests, confirm Shipping Company is connected; otherwise use **Manual** shipping method.
- For cycle-count My tasks, confirm worker profile linkage.

If preconditions cannot be met, mark the scenario **BLOCKED** with reason — do not fail the product.

---

## How to expand a matrix row into steps

Example: `OMS-01`

1. Open client portal → login as client_admin.
2. Online orders → Create order.
3. Fill fields per `03-CLIENT-PORTAL.md` / `06-OMS-WORKFLOW.md`.
4. Place map pin.
5. Submit for approval.
6. Expect list row **Waiting for Confirmation**.

Always reconcile field names with what you see on screen (labels may be localized).

---

## Evidence standard for bugs

Include:

- Scenario ID
- Actor role
- Environment URL
- Step number where it failed
- Expected (quote doc section if possible)
- Actual (what UI showed)
- Screenshot or recording reference
- Confidence of the cited requirement (High/Medium/Low)

---

## Feature flags & optional UI

Before failing nav-missing bugs, check whether the feature is flag-gated:

- OMS COD / OMS Returns
- Google Drive backups
- Google Sign-In

If the entire module is absent, treat as configuration unless docs claim it is always on.

---

## Realtime checks

When testing RT-* scenarios:

1. Use two browser profiles/users when possible.
2. Allow a few seconds for live update.
3. If no update, refresh once.
4. If refresh shows data but live did not → report realtime issue, not missing data.

---

## Language

Default to English unless localization is in scope. When testing Arabic:

- Expect major chrome translated
- Incomplete string translation alone is usually **localization gap**, not workflow failure, unless a control is unusable

---

## What success looks like

A good QA run produces:

- Pass/fail per scenario ID
- Blocked list with missing preconditions
- Bug reports only where docs + UI disagree with High confidence
- A short summary of End-to-End paths verified (especially E2E-01)

---

## Business Logic Testing

Do **not** stop after verifying “the button worked.”

For important scenarios you must also verify **the resulting business state is correct**.

### Required sequence for business-critical actions

1. **Record initial state** — statuses, quantities, money fields, stock (Available / Reserved / On hand), related entity IDs.
2. **Perform the action** through the UI.
3. **Verify visible result** — toast, badge, navigation.
4. **Verify resulting entity state** — same record’s status and fields.
5. **Verify related entities** — e.g. OMS ↔ Outbound ↔ Tasks.
6. **Verify calculations** — recompute using `19-CALCULATIONS-AND-DERIVED-VALUES.md` and compare.
7. **Verify inventory effects** — only at stages documented in `18` / `20` / `21` (task-only: major on-hand drop at dispatch, not at approve).
8. **Verify financial effects** — shipping fee, COD, invoice line counts when in scope.
9. **Verify notifications/documents** when the journey says they apply.
10. **Check forbidden states** — list in `18-BUSINESS-RULES-AND-INVARIANTS.md`.
11. **Reconcile related screens** — do not test one page in isolation when `20` / `CONS-*` scenarios apply.

### Primary sources for “what MUST be true”

| Concern | Read |
|---------|------|
| Business rules / forbidden states | `18-BUSINESS-RULES-AND-INVARIANTS.md` |
| Formulas | `19-CALCULATIONS-AND-DERIVED-VALUES.md` |
| Module sync | `20-CROSS-MODULE-INVARIANTS.md` |
| Full journeys | `21-END-TO-END-INVARIANTS.md` |
| Known doc tensions | `22-DOCUMENTATION-CONFLICTS.md` |

### Anti-hallucination

| Label | Meaning | May file as bug? |
|-------|---------|------------------|
| Confirmed / High | Supported by implementation + docs | Yes, if UI violates it |
| Medium | Likely but flag- or path-dependent | Only after staging verification |
| UNKNOWN / NEEDS VERIFICATION | Not established | **No** — report as needs verification |
| Conflict ID | Docs disagree | Verify per `22`; cite conflict ID |

Never turn an assumption into a bug.

### Evidence for business-logic bugs

Include:

```text
Initial values
Action performed
Expected calculation/state (cite rule/CALC ID)
Actual calculation/state
Related entity values (other screens)
Final state
Evidence (screenshots / stored values)
```

Example:

```text
Expected: 2 × $50 + shipping $10 = $110
Actual: $220
Evidence: OMS detail + COD / invoice screens
Rule: CALC-OMS-002
```

Classify calculation failures separately from UI click failures.

### Duplicate-action / idempotency

When testing Approve, Confirm, Mark delivered, Dispatch, Send shipment:

1. Perform once — record IDs and stock.
2. Perform again.
3. Expect no-op or blocked action; **no** second outbound, **no** second stock decrement (see DUP-* scenarios).

---

## Reminder

This documentation is the **product expected-behavior reference**, reverse-engineered from the current system. If staging behavior was recently fixed (for example map circle or OMS create fields), trust the **current UI** and update the docs if they lag — do not silently invent older bugs.
