# EMDAD 3PL WMS — Test plan set (written 14 Nov 2026)

**Scope of this deliverable (phase 1 of 3):** *write down* every test that has to be run. No test code is written here, no test is executed here.
Phase 2 = implement the tests (Playwright / Vitest / Jest / k6 …). Phase 3 = execute, report, fix, re-run.

**Goal of the whole exercise:** decide whether the system is stable enough to be released to the client. If every test in these files passes, the system is releasable; every failure is a defect to fix first. Zero bugs is *not* the goal — a trustworthy answer to "can we release?" is.

**Start from zero.** Previous QA (`docs/handover/QA_TRACKER.md`, `QA_FLOWS.md`, `tests/e2e`, `frontend/e2e`, 165 backend specs, 32 frontend specs) is used only as a *source of ideas* (see `15-legacy-test-mapping.md`). Nothing from it counts as "done": the system changed a lot (invoice redesign, storage/incentive billing, B3/B12/B15, custom roles, Google UI hidden, carrier adapters).

---

## 1. Document map

| File | What it contains |
|---|---|
| `00-README-test-strategy.md` | This file: conventions, rules, test-case format, evidence, result format, definition of "100 % coverage" |
| `01-unit-testing.md` | Backend + frontend unit test cases (pure logic, services with mocked I/O) |
| `02-component-testing.md` | UI component tests (React components in isolation, both frontends) |
| `03-integration-testing.md` | API + DB + module-to-module + carrier-adapter contract tests |
| `04-e2e-testing.md` | Browser workflows (business flows) — admin + client, with data setup |
| `04a-e2e-page-catalogue-admin.md` | One section per admin page: elements, standard batteries, page-specific cases |
| `04b-e2e-page-catalogue-client.md` | Same for the client portal |
| `05-system-testing.md` | Cross-module business-logic / semantic correctness (money, stock, currency, state machines) |
| `06-regression-testing.md` | What must be re-run after every change; fixed-defect regression pack; smoke subset |
| `07-sanity-testing.md` | 15-minute go/no-go checks after each deploy |
| `08-performance-testing.md` | Load, latency, N+1, large-list, export, memory |
| `09-security-testing.md` | AuthN/Z, RBAC matrix, tenant isolation, injection, uploads, webhooks, secrets |
| `10-accessibility-testing.md` | Keyboard, screen reader, contrast, focus, RTL a11y |
| `11-visual-testing.md` | Visual regression + layout/alignment defects per page × 4 devices |
| `12-ux-testing.md` | User-experience heuristics + known friction list (search-box bug, 0-prefilled numbers …) |
| `13-uat-testing.md` | Owner/client acceptance scenarios (Arabic/English, real workflows) |
| `14-coverage-matrix.md` | Every route / module / endpoint → which test files and IDs cover it (proof of 100 % coverage) |
| `15-legacy-test-mapping.md` | Old tests/flows → new IDs; what must be rewritten |
| `16-observed-issues-during-capture.md` | Defect candidates seen while taking the screenshots (not yet confirmed) |
| `17-assumptions-to-confirm.md` | Expected behaviours I inferred and the owner must confirm *before* they are used as pass/fail oracles |
| `18-test-data-and-environment.md` | Accounts, seed data, safe-mutation rules, carrier rules, reset procedures |
| `20-remaining-capture-backlog.md` | What is still not photographed/inspected (pages, modals, roles, AR/dark) — work list for the capture executor |
| `CURSOR_CAPTURE_PROMPT.md` | Ready-to-paste prompt for Cursor to finish that backlog (look-only, no mutations) |
| `19-results-report-template.md` | Mandatory format of the final report (why each test passed / failed) |
| `generated/` | Auto-generated inventories (594 endpoints, unit gap lists) + generator script |
| `screenshots/staging-admin-frontend-screenshots/{desktop,laptop,tablet,mobile}/` | Numbered screenshots of every admin page, 4 devices |
| `screenshots/staging-client-frontend-screenshots/{desktop,laptop,tablet,mobile}/` | Same for the client portal — **only `/login` captured so far** (needs an authenticated client session; see `14` §9) |
| `screenshots/visual-notes.md`, `screenshots/assign.py` | raw capture notes; helper that files captured images into the numbered folders |

---

## 2. Rules of engagement for whoever executes these tests

1. **Staging only.** `/var/www/emdad-sy-3pl-wms-staging`, branch `staging`, PM2 id 1, DB `wms_db_staging`, URLs `staging-admin.emdadsy.com` / `staging-client.emdadsy.com`. Production (PM2 id 0, DB `wms_db`) is never touched.
2. **Test data identity:** client "Test company", recipient "Nadim Hassan", note "TEST ORDER". Names of anything created start with `QA-`.
3. **Carriers:** Sena = sandbox (free to use). Babel, Sila, Delivery Joud, Fatih are **live** — a live call needs the owner's per-shipment yes. Never touch an order inside a carrier portal without saying which code first; search by exact code and stop unless exactly one row matches.
4. **Passwords are never typed by the test agent.** Browser sessions are the owner's (Chrome tab group). API tests use the QA accounts defined in `18`.
5. **No TLS weakening, no secrets in logs.** Google credentials, API keys, `.env` content never appear in reports.
6. **DB migrations / destructive SQL** only with explicit owner approval (show SQL first).
7. **Mutating tests** must be idempotent or self-cleaning (create `QA-…`, cancel/delete `QA-…` afterwards) and must declare the cleanup step.
8. **Every assertion needs an oracle.** An expected result is only valid if its source is one of: **S** (owner/client said so — cite chat/doc), **D** (documented in repo — cite file), **C** (code contract — cite file:line), **I** (inferred by the test author → listed in `17-assumptions-to-confirm.md`; a test whose oracle is `I` may not be reported as a *defect* until the owner confirms).

---

## 3. Test-case format (used in every file)

```
ID        <TYPE>-<AREA>-<NN>          e.g. UT-BIL-014, E2E-OMS-031, SEC-RBAC-007
Title     one line
Pri       P0 release-blocker · P1 must pass · P2 should pass · P3 nice
Pre       data / state / role needed
Steps     numbered, one action each (UI: what to click/type; API: method + path + body)
Expected  observable result(s), numbers where relevant
Oracle    S/D/C/I + reference
Evidence  screenshot name / response body / DB query to attach
Auto      Y (can be scripted) / N (needs human eyes)
```

Result states: `PASS`, `FAIL(defect id)`, `BLOCKED(reason)`, `N/A(reason)`. "SKIPPED" is not allowed without a reason.

Defect severity: **S1** data loss/money wrong/security hole/cannot work · **S2** feature broken, workaround exists · **S3** wrong/misleading but harmless · **S4** cosmetic. Release rule: no open S1/S2.

---

## 4. Devices (every UI test runs on all four unless marked otherwise)

| Device | Viewport (CSS px) | Notes |
|---|---|---|
| desktop | 1920 × 1080 | primary; sidebar expanded |
| laptop | 1366 × 768 | most common admin laptop |
| tablet | 820 × 1180 (portrait) and 1180 × 820 (landscape for P0 pages) | sidebar behaviour must be defined |
| mobile | 390 × 844 | touch targets ≥ 44 px; no horizontal page scroll; RTL checked |

Plus browsers: Chrome (primary), Edge, Firefox (smoke only), Safari/WebKit (smoke only, because the client portal may be used on iPhone).
Languages: English + Arabic (RTL) for every page that has language switching. Themes: light + dark.

---

## 5. Definition of "100 % coverage" for this project

Coverage is **inventory-based**, not line-based. The inventory is:

| Inventory | Size now | Where listed | Covered by |
|---|---|---|---|
| Admin routes | every path in `frontend/src/router.tsx`: 88 captured pages (75 static + 13 detail/dynamic with real ids) + pending dynamic/modal states (listed in `04a`) + 31 redirect-only routes (checked programmatically: no router path is missing from `04a`) | `04a` | E2E + VIS + UX + A11Y + SEC(RBAC) |
| Client routes | every path in `client-frontend/src/App.tsx`: 37 entries incl. aliases/404 (checked programmatically) | `04b` | same |
| HTTP endpoints | **594** (`generated/ENDPOINT_CATALOGUE.md`) | `03` + `14` | IT (happy + validation + auth) |
| Backend modules | 31 | `01`,`03` | UT + IT |
| Business flows | F01–F42 + X01–X16 (legacy ids) re-based to `E2E-*`/`SYS-*` | `04`,`05` | E2E + SYS |
| Carriers | 5 live + mock | `03`,`05` | contract + E2E |
| UI elements | every button / input / dropdown / tab / modal / row action on every page | `04a`,`04b` | page batteries + page-specific |
| Roles | super_admin, wh_manager, wh_operator, finance, accountant, inventory, viewer, custom roles, client_admin, client_staff | `09` | RBAC matrix |

`14-coverage-matrix.md` must show **no empty cell**. A row is only complete when each applicable test type has at least one case ID.
Line coverage numbers (Vitest/Jest `--coverage`) are collected as a secondary signal; targets in `01`.

---

## 6. Order of execution (phase 3)

1. `07` sanity → stop if it fails.
2. `01` unit + `02` component (fast, CI).
3. `03` integration (API + DB) — creates the QA data used by `04`.
4. `04` E2E per page catalogue, device by device; capture screenshots into the two screenshot trees (names `<seq>_<route>.png`, plus `_<state>` suffix for modal/error/empty states).
5. `05` system / business logic (uses numbers produced in 03/04).
6. `09` security, `08` performance, `10` a11y, `11` visual, `12` UX.
7. `13` UAT with the owner/client.
8. `06` regression pack after every fix. Final run of everything = release candidate verdict.

---

## 7. What the final report must contain (details in `19`)

For **every** executed test: result, *why* it passed or failed (observed vs expected in numbers/words), the oracle used, assumptions made, and evidence. If an assumption turns out to be wrong the owner can then see exactly which tests depended on it. A summary alone ("212 passed") is not acceptable.

---

## 8. Honest status of this deliverable (14 Nov 2026)

* **Written:** all 20 plan files above, 3 generators, and 352 admin screenshots (88 pages × 4 devices) + client login ×4.
* **Not yet possible / not yet done (listed in `14` §9):** client-portal screenshots beyond `/login` (needs the owner's login), dynamic admin routes that need special data, modal/empty/error states, Arabic/dark/role baselines. These are *capture* gaps; the test cases that cover those pages already exist.
* **Self-check performed:** every path in both routers appears in a catalogue; every one of the 594 endpoints belongs to a module section in `03`; every backend/frontend file without a unit test is accounted for by generated gap lists.
* **Needs owner input before phase 3:** `17-assumptions-to-confirm.md` (3 blocking: A-03 currency display, A-18 rounding, A-22 COD/shipping semantics).
* PNG files are matched by `.gitignore` (`*.png`); they exist on the VPS under `docs/testing/screenshots/` and are not in git unless force-added.
