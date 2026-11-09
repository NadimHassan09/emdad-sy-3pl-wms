# Testing sprint schedule (after implementation reaches 100%)

Do **not** block the implementation sprint on these. Run them as a dedicated pass once remaining I-* / client inventory rows are code-complete.

## Layer A — Code / API (fast, run during impl when touching a module)

| ID | What | Command / target | Status |
|----|------|------------------|--------|
| A1 | Backend unit suite | `cd backend && npm run test:unit` | schedule after each module batch |
| A2 | Playwright API smoke | against `http://127.0.0.1:3001/api` | end of impl day |
| A3 | FX custom-api unit | `fx-custom-config.unit.spec.ts` | with I-12 |
| A4 | Syria address suggestions | `syria-address.unit.spec.ts` | with I-9 |

## Layer B — Workflows F01–F42 (browser, owner session)

| Batch | Flows | Notes | Status |
|-------|-------|-------|--------|
| B1 | F01–F08 | create / approve / stock / ready_to_ship | ⬜ scheduled |
| B2 | F09–F14 | edit (I-3), failed delivery, returns | ⬜ scheduled |
| B3 | F15–F20 | carriers: Sena sandbox, Babel/Sila/Joud live read-only cross-check | ⬜ scheduled |
| B4 | F21–F30 | finance / COD / invoices / FX conversion | ⬜ scheduled |
| B5 | F31–F42 | remaining ops + edge failure paths | ⬜ scheduled |

## Layer C — Page sweep (QA_TRACKER routes)

| Batch | Scope | Status |
|-------|-------|--------|
| C1 | Admin routes Functional + Validation | ⬜ scheduled |
| C2 | Admin Roles + Consistency + Mobile 390px (incl. I-8 company selector) | ⬜ scheduled |
| C3 | Client portal routes same five axes | ⬜ scheduled |
| C4 | Cross-cutting X01–X16 | ⬜ scheduled |

## Explicitly deferred from impl sprint

- Full browser verification of I-2 exports (mark 🔍 until Layer C)
- Live carrier create beyond already-approved Test company orders
- I-3 after-delivery edit policy (needs owner answer Q)
- Penetration / adversarial testing (out of scope)

## Exit criteria for “system ready for production”

1. Implementation inventory ✅ (no open agreed I-* / client rows except ❓ owner decisions)
2. Layer A green
3. Layers B + C marked ✅ in QA_FLOWS / QA_TRACKER with screenshots
4. Open S1/S2 = 0
5. Handover pack present
